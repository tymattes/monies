import { and, eq, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { budgetAllocations, categories } from "@/db/schema";
import type { HouseholdContext } from "./household";
import { HttpError } from "./http";
import { getIncomeMonth } from "./income";
import { currentMonth, monthStart } from "./months";

export const MAX_AMOUNT = 2_000_000_000;

export type BudgetLine = { id: string; name: string; amountCents: number };

export type Budget = {
  month: string;
  currency: string;
  editable: boolean;
  categories: BudgetLine[];
  totalCents: number;
  // Household income for the month and what is left after budgeting it.
  // Negative unallocated means the budget exceeds income.
  incomeCents: number;
  unallocatedCents: number;
};

// A category shows in month M when start_month <= M < archived_from (if any).
const visibleIn = (month: string) =>
  and(
    lte(categories.startMonth, monthStart(month)),
    sql`(${categories.archivedFrom} is null or ${monthStart(month)} < ${categories.archivedFrom})`,
  );

// The amount for a month is the allocation with the latest effective_month on
// or before it (0 if none), so later months inherit earlier amounts.
export async function getBudget(
  ctx: HouseholdContext,
  month: string,
): Promise<Budget> {
  const rows = await getDb()
    .select({
      id: categories.id,
      name: categories.name,
      amountCents: sql<number>`coalesce((
        select a.amount_cents from ${budgetAllocations} a
        where a.category_id = "categories"."id"
          and a.effective_month <= ${monthStart(month)}
        order by a.effective_month desc limit 1
      ), 0)`.mapWith(Number),
    })
    .from(categories)
    .where(and(eq(categories.householdId, ctx.household.id), visibleIn(month)))
    .orderBy(categories.position, categories.name);

  const totalCents = rows.reduce((sum, r) => sum + r.amountCents, 0);
  const { totalCents: incomeCents } = await getIncomeMonth(ctx, month);
  return {
    month,
    currency: ctx.household.currency,
    editable: month >= currentMonth(),
    categories: rows,
    totalCents,
    incomeCents,
    unallocatedCents: incomeCents - totalCents,
  };
}

// Writes an allocation effective from `month` onward. Past months are
// read-only so history can never be rewritten.
export async function setAllocation(
  ctx: HouseholdContext,
  month: string,
  categoryId: string,
  amountCents: number,
) {
  if (month < currentMonth()) {
    throw new HttpError(400, "Past months are read-only");
  }
  const [category] = await getDb()
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.id, categoryId),
        eq(categories.householdId, ctx.household.id),
        visibleIn(month),
      ),
    );
  if (!category) throw new HttpError(404, "Category not found for this month");

  await getDb()
    .insert(budgetAllocations)
    .values({
      categoryId,
      effectiveMonth: monthStart(month),
      amountCents,
      createdBy: ctx.user.id,
    })
    .onConflictDoUpdate({
      target: [budgetAllocations.categoryId, budgetAllocations.effectiveMonth],
      set: { amountCents, createdBy: ctx.user.id },
    });
}

// Adds the month's unallocated amount to a category, from `month` onward, as
// an ordinary allocation. A per-household-and-month advisory lock serializes
// concurrent assigns: the second one waits, then sees unallocated = 0 and is
// rejected, so the amount can never be assigned twice.
export async function assignUnallocated(
  ctx: HouseholdContext,
  month: string,
  categoryId: string,
) {
  if (month < currentMonth()) {
    throw new HttpError(400, "Past months are read-only");
  }
  return getDb().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`${ctx.household.id}:${month}`}, 0))`,
    );

    // Read after taking the lock so any earlier assign is already committed.
    const budget = await getBudget(ctx, month);
    const line = budget.categories.find((c) => c.id === categoryId);
    if (!line) throw new HttpError(404, "Category not found for this month");
    if (budget.unallocatedCents <= 0) {
      throw new HttpError(400, "There is no unallocated amount to assign");
    }
    const amountCents = line.amountCents + budget.unallocatedCents;
    if (amountCents > MAX_AMOUNT) {
      throw new HttpError(400, "That would exceed the maximum amount");
    }

    await tx
      .insert(budgetAllocations)
      .values({
        categoryId,
        effectiveMonth: monthStart(month),
        amountCents,
        createdBy: ctx.user.id,
      })
      .onConflictDoUpdate({
        target: [budgetAllocations.categoryId, budgetAllocations.effectiveMonth],
        set: { amountCents, createdBy: ctx.user.id },
      });

    return {
      month,
      categoryId,
      assignedCents: budget.unallocatedCents,
      amountCents,
      unallocatedCents: 0,
    };
  });
}
