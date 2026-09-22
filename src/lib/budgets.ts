import { and, eq, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { budgetAllocations, categories, goalAmounts } from "@/db/schema";
import type { HouseholdContext } from "./household";
import { billsRollup } from "./bills";
import { getGoalsMonth, type GoalLine } from "./goals";
import { HttpError } from "./http";
import { getIncomeMonth } from "./income";
import { addMonths, currentMonth, monthStart } from "./months";
import { expensesRollup } from "./expenses";

export const MAX_AMOUNT = 2_000_000_000;

export type BudgetLine = {
  id: string;
  name: string;
  amountCents: number;
  // Monthly cost of the bills in this category, and the expenses logged
  // against it this month (spec 019), and what is left of the budget after
  // both.
  billsCents: number;
  expensesCents: number;
  remainingCents: number;
};

export type Budget = {
  month: string;
  currency: string;
  editable: boolean;
  categories: BudgetLine[];
  // Saving/Debt payoff goals for the month (spec 014) — a separate concept
  // from Expense categories. Their planned sums (totalCents/goalsTotalCents)
  // are planning-only figures with no bearing on Unallocated (spec 022); only
  // a checked-off goal claims real income.
  goals: GoalLine[];
  // Sum of `categories` only (unchanged meaning from before spec 014).
  totalCents: number;
  goalsTotalCents: number;
  // Household income for the month and what is left after the money claimed
  // by something real (bills, logged expenses, checked-off goals). Negative
  // unallocated means those commitments exceed income (spec 022).
  incomeCents: number;
  // Variable income may still arrive this month (or is not known yet for a
  // future one), so income is not final; see spec 010.
  incomeProvisional: boolean;
  unallocatedCents: number;
  // Total monthly bills, total logged expenses (spec 019), the sum of
  // checked-off goal amounts (spec 022), and what is left of income after
  // bills.
  billsTotalCents: number;
  expensesTotalCents: number;
  checkedGoalsTotalCents: number;
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
  const spent = await expensesRollup(ctx.household.id, month);
  const goalsMonth = await getGoalsMonth(ctx, month);
  const checkedGoalsTotalCents = goalsMonth.goals
    .filter((g) => g.checked)
    .reduce((sum, g) => sum + g.amountCents, 0);
  return {
    month,
    currency: ctx.household.currency,
    editable: month >= currentMonth(),
    categories: rows.map((r) => {
      const billsCents = bills.byCategory.get(r.id) ?? 0;
      const expensesCents = spent.byCategory.get(r.id) ?? 0;
      return {
        ...r,
        billsCents,
        expensesCents,
        remainingCents: r.amountCents - billsCents - expensesCents,
      };
    }),
    goals: goalsMonth.goals,
    totalCents,
    goalsTotalCents: goalsMonth.totalCents,
    incomeCents,
    incomeProvisional,
    // Unallocated shrinks only for money claimed by something real: a bill,
    // a logged expense, or a checked-off goal (spec 022). Category budgets
    // and unchecked goal targets are plans, not facts, and reserve nothing.
    unallocatedCents:
      incomeCents - bills.totalCents - spent.totalCents - checkedGoalsTotalCents,
    billsTotalCents: bills.totalCents,
    expensesTotalCents: spent.totalCents,
    checkedGoalsTotalCents,
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

// A row targets a goal, the only kind Assign supports (spec 020).
export type Assignment = { goalId: string; amountCents: number };

export const MAX_ASSIGNMENTS = 50;

// Adds part or all of the month's unallocated amount to one or more goals,
// from `month` onward, as ordinary goal allocations, all in one transaction
// (either every assignment applies or none does). `request` is either
// explicit `assignments`, or `{ goalId }` meaning "all of it to this one."
// A per-household-and-month advisory lock serializes concurrent assigns: the
// loser waits, then sees the new unallocated amount and is rejected if it no
// longer fits, so money can never be assigned twice. Categories are not a
// valid target (spec 020) — a category's budget is set by hand on Budget or
// reflects what it actually costs, never by leftover income routed into it.
export async function assignUnallocated(
  ctx: HouseholdContext,
  month: string,
  request: { goalId: string } | { assignments: Assignment[] },
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
        : [{ goalId: request.goalId, amountCents: budget.unallocatedCents }];

    const seen = new Set<string>();
    let assignedCents = 0;
    const results: {
      goalId: string;
      assignedCents: number;
      amountCents: number;
      beforeCents: number;
    }[] = [];
    for (const a of assignments) {
      const key = `goal:${a.goalId}`;
      if (seen.has(key)) {
        throw new HttpError(400, "Each goal can only appear once");
      }
      seen.add(key);
      const line = budget.goals.find((g) => g.id === a.goalId);
      if (!line) throw new HttpError(404, "Goal not found for this month");
      const amountCents = line.amountCents + a.amountCents;
      if (amountCents > MAX_AMOUNT) {
        throw new HttpError(400, "That would exceed the maximum amount");
      }
      assignedCents += a.amountCents;
      results.push({
        goalId: a.goalId,
        assignedCents: a.amountCents,
        amountCents,
        beforeCents: line.amountCents,
      });
    }
    if (assignedCents > budget.unallocatedCents) {
      throw new HttpError(
        400,
        "The amounts add up to more than the unallocated amount",
      );
    }

    // Money assigned from unallocated is this month's leftover, not a
    // deliberate raise (spec 017) — so besides the normal bump for `month`,
    // each goal also gets a companion row for `month + 1` reverting it to
    // its pre-assign amount, unless one already exists there (a deliberate
    // future plan, or an earlier assign's own revert this same month) —
    // onConflictDoNothing leaves that alone rather than overwrite it.
    // Months after that inherit the reversion automatically through the
    // normal "latest effective row on or before it" rule.
    const nextMonth = monthStart(addMonths(month, 1));
    for (const r of results) {
      await tx
        .insert(goalAmounts)
        .values({
          goalId: r.goalId,
          effectiveMonth: monthStart(month),
          amountCents: r.amountCents,
          createdBy: ctx.user.id,
        })
        .onConflictDoUpdate({
          target: [goalAmounts.goalId, goalAmounts.effectiveMonth],
          set: { amountCents: r.amountCents, createdBy: ctx.user.id },
        });
      await tx
        .insert(goalAmounts)
        .values({
          goalId: r.goalId,
          effectiveMonth: nextMonth,
          amountCents: r.beforeCents,
          createdBy: ctx.user.id,
        })
        .onConflictDoNothing({
          target: [goalAmounts.goalId, goalAmounts.effectiveMonth],
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
