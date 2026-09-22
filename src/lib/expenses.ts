import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { categories, expenses } from "@/db/schema";
import type { HouseholdContext } from "./household";
import { HttpError } from "./http";
import { addMonths, currentDate, monthStart } from "./months";

// A category shows in month M when start_month <= M < archived_from (if any).
// Duplicated from budgets.ts/income.ts/goals.ts — consolidating those four
// copies is a follow-up chore, not this spec's job (spec 019).
const visibleIn = (month: string) =>
  and(
    sql`${categories.startMonth} <= ${monthStart(month)}`,
    sql`(${categories.archivedFrom} is null or ${monthStart(month)} < ${categories.archivedFrom})`,
  );

// Loads a category scoped to the household and checks it is active in
// `month`, the same rule bills use to decide what a bill can attach to.
async function assertCategoryActive(
  ctx: HouseholdContext,
  categoryId: string,
  month: string,
) {
  const [category] = await getDb()
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(
      and(
        eq(categories.id, categoryId),
        eq(categories.householdId, ctx.household.id),
        visibleIn(month),
      ),
    );
  if (!category) throw new HttpError(404, "Category not found for this month");
  return category;
}

// Logs a fact: money spent on a category on a given date. Past dates are
// fine (an expense is history, not a plan); future dates are rejected —
// nothing has happened yet to record (spec 019).
export async function addExpense(
  ctx: HouseholdContext,
  input: {
    categoryId: string;
    amountCents: number;
    spentOn: string;
    description: string | null;
  },
) {
  if (input.spentOn > currentDate()) {
    throw new HttpError(400, "You can't log an expense for a future date");
  }
  const category = await assertCategoryActive(
    ctx,
    input.categoryId,
    input.spentOn.slice(0, 7),
  );
  const [row] = await getDb()
    .insert(expenses)
    .values({ ...input, addedBy: ctx.user.id })
    .returning();
  return { ...row, categoryName: category.name };
}

// Any household member can delete any expense (added_by is informational,
// the same as a bill's, spec 019).
export async function deleteExpense(ctx: HouseholdContext, id: string) {
  const [row] = await getDb()
    .select({ expense: expenses, category: categories })
    .from(expenses)
    .innerJoin(categories, eq(categories.id, expenses.categoryId))
    .where(
      and(
        eq(expenses.id, id),
        eq(categories.householdId, ctx.household.id),
      ),
    );
  if (!row) throw new HttpError(404, "Expense not found");
  await getDb().delete(expenses).where(eq(expenses.id, id));
}

export type ExpenseLine = {
  id: string;
  categoryId: string;
  categoryName: string;
  spentOn: string;
  amountCents: number;
  description: string | null;
};

export type ExpensesMonth = {
  month: string;
  currency: string;
  expenses: ExpenseLine[];
  totalCents: number;
};

// The month's expenses, newest spent_on first. An expense counts in the
// month of spent_on, the same way a variable deposit counts in the month of
// received_on (spec 006).
export async function getExpensesMonth(
  ctx: HouseholdContext,
  month: string,
): Promise<ExpensesMonth> {
  const start = monthStart(month);
  const end = monthStart(addMonths(month, 1));
  const rows = await getDb()
    .select({
      id: expenses.id,
      categoryId: expenses.categoryId,
      categoryName: categories.name,
      spentOn: expenses.spentOn,
      amountCents: expenses.amountCents,
      description: expenses.description,
    })
    .from(expenses)
    .innerJoin(categories, eq(categories.id, expenses.categoryId))
    .where(
      and(
        eq(categories.householdId, ctx.household.id),
        gte(expenses.spentOn, start),
        lt(expenses.spentOn, end),
      ),
    )
    .orderBy(desc(expenses.spentOn), desc(expenses.createdAt));
  return {
    month,
    currency: ctx.household.currency,
    expenses: rows,
    totalCents: rows.reduce((sum, r) => sum + r.amountCents, 0),
  };
}

// Committed spend per category for a month, for the Budget page's rollup.
export async function expensesRollup(householdId: string, month: string) {
  const start = monthStart(month);
  const end = monthStart(addMonths(month, 1));
  const rows = await getDb()
    .select({
      categoryId: expenses.categoryId,
      amountCents: expenses.amountCents,
    })
    .from(expenses)
    .innerJoin(categories, eq(categories.id, expenses.categoryId))
    .where(
      and(
        eq(categories.householdId, householdId),
        gte(expenses.spentOn, start),
        lt(expenses.spentOn, end),
      ),
    );
  const byCategory = new Map<string, number>();
  for (const r of rows) {
    byCategory.set(r.categoryId, (byCategory.get(r.categoryId) ?? 0) + r.amountCents);
  }
  return {
    byCategory,
    totalCents: rows.reduce((sum, r) => sum + r.amountCents, 0),
  };
}
