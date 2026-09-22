import { and, eq, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { budgetAllocations, categories } from "@/db/schema";
import type { CategoryType } from "./categoryTypes";
import type { HouseholdContext } from "./household";
import { billsRollup } from "./bills";
import { HttpError } from "./http";
import { getIncomeMonth } from "./income";
import { currentMonth, monthStart } from "./months";

export const MAX_AMOUNT = 2_000_000_000;

export type BudgetLine = {
  id: string;
  name: string;
  // What kind of budget line this is (spec 012): spending, saving, or debt
  // payoff. Drives grouping on the Budget page and Overview, not the totals.
  type: CategoryType;
  amountCents: number;
  // Monthly cost of the bills in this category, and what is left of the budget after them.
  billsCents: number;
  remainingCents: number;
};

export type Budget = {
  month: string;
  currency: string;
  editable: boolean;
  categories: BudgetLine[];
  totalCents: number;
  // Household income for the month and what is left after budgeting it.
  // Negative unallocated means the budget exceeds income.
  incomeCents: number;
  // Variable income may still arrive this month (or is not known yet for a
  // future one), so income is not final; see spec 010.
  incomeProvisional: boolean;
  unallocatedCents: number;
  // Total monthly bills and what is left of income after them.
  billsTotalCents: number;
  leftAfterBillsCents: number;
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
      type: sql<CategoryType>`${categories.type}`,
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
  const { totalCents: incomeCents, provisional: incomeProvisional } =
    await getIncomeMonth(ctx, month);
  const bills = await billsRollup(ctx.household.id, month);
  return {
    month,
    currency: ctx.household.currency,
    editable: month >= currentMonth(),
    categories: rows.map((r) => {
      const billsCents = bills.byCategory.get(r.id) ?? 0;
      return { ...r, billsCents, remainingCents: r.amountCents - billsCents };
    }),
    totalCents,
    incomeCents,
    incomeProvisional,
    unallocatedCents: incomeCents - totalCents,
    billsTotalCents: bills.totalCents,
    leftAfterBillsCents: incomeCents - bills.totalCents,
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

export type Assignment = { categoryId: string; amountCents: number };

export const MAX_ASSIGNMENTS = 50;

// Adds part or all of the month's unallocated amount to one or more
// categories, from `month` onward, as ordinary allocations, all in one
// transaction (either every assignment applies or none does). `request` is
// either explicit `assignments`, or `{ categoryId }` meaning "all of it to this
// category". A per-household-and-month advisory lock serializes concurrent
// assigns: the loser waits, then sees the new unallocated amount and is
// rejected if it no longer fits, so money can never be assigned twice.
export async function assignUnallocated(
  ctx: HouseholdContext,
  month: string,
  request: { categoryId: string } | { assignments: Assignment[] },
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
    if (budget.unallocatedCents <= 0) {
      throw new HttpError(400, "There is no unallocated amount to assign");
    }
    const assignments: Assignment[] =
      "assignments" in request
        ? request.assignments
        : [{ categoryId: request.categoryId, amountCents: budget.unallocatedCents }];

    const seen = new Set<string>();
    let assignedCents = 0;
    const results: { categoryId: string; assignedCents: number; amountCents: number }[] = [];
    for (const a of assignments) {
      if (seen.has(a.categoryId)) {
        throw new HttpError(400, "Each category can only appear once");
      }
      seen.add(a.categoryId);
      const line = budget.categories.find((c) => c.id === a.categoryId);
      if (!line) throw new HttpError(404, "Category not found for this month");
      const amountCents = line.amountCents + a.amountCents;
      if (amountCents > MAX_AMOUNT) {
        throw new HttpError(400, "That would exceed the maximum amount");
      }
      assignedCents += a.amountCents;
      results.push({ categoryId: a.categoryId, assignedCents: a.amountCents, amountCents });
    }
    if (assignedCents > budget.unallocatedCents) {
      throw new HttpError(
        400,
        "The amounts add up to more than the unallocated amount",
      );
    }

    for (const r of results) {
      await tx
        .insert(budgetAllocations)
        .values({
          categoryId: r.categoryId,
          effectiveMonth: monthStart(month),
          amountCents: r.amountCents,
          createdBy: ctx.user.id,
        })
        .onConflictDoUpdate({
          target: [budgetAllocations.categoryId, budgetAllocations.effectiveMonth],
          set: { amountCents: r.amountCents, createdBy: ctx.user.id },
        });
    }

    return {
      month,
      assignments: results,
      assignedCents,
      unallocatedCents: budget.unallocatedCents - assignedCents,
    };
  });
}
