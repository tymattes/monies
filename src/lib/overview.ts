import { getBillsMonth } from "./bills";
import { getBudget } from "./budgets";
import { getExpensesMonth, type ExpenseLine } from "./expenses";
import type { GoalType } from "./goalTypes";
import type { HouseholdContext } from "./household";
import { getIncomeMonth } from "./income";
import { buildTasks, type Task } from "./tasks";

export type { TaskCode, Task } from "./tasks";

export type OverviewCategory = {
  id: string;
  name: string;
  budgetedCents: number;
  billsCents: number;
  expensesCents: number;
  leftCents: number;
};

export type OverviewGoal = {
  id: string;
  name: string;
  type: GoalType;
  amountCents: number;
  checked: boolean;
};

export type Overview = {
  month: string;
  currency: string;
  householdName: string;
  editable: boolean;
  // See spec 010: income is what is recorded so far and may still grow.
  incomeProvisional: boolean;
  income: {
    totalCents: number;
    fixedCents: number;
    variableCents: number;
    byMember: { memberId: string | null; name: string; totalCents: number }[];
  };
  bills: {
    totalCents: number;
    byCategory: { categoryId: string; name: string; totalCents: number }[];
    largest: {
      id: string;
      name: string;
      categoryName: string;
      monthlyCents: number;
      amountCents: number;
      intervalMonths: number;
    }[];
  };
  // Expense categories plus goals (spec 014) — the planned total, a
  // planning-only figure (spec 022). `unallocatedCents` is income minus
  // bills, expenses and checked-off goals; `overAllocatedCents` when negative.
  budget: { budgetedCents: number; unallocatedCents: number };
  // The four terms of spec 022's Unallocated formula, for the stacked bar
  // (spec 021): Bills, Expenses, checked-off Goal contributions, and
  // Unallocated (the hatched remainder). `unallocatedCents` is
  // income − bills − expenses − checked goals when positive,
  // `overAllocatedCents` when negative.
  cashFlow: {
    incomeCents: number;
    billsCents: number;
    expensesCents: number;
    checkedSavingCents: number;
    checkedDebtPayoffCents: number;
    unallocatedCents: number;
    overAllocatedCents: number;
    // Full goal targets by type (spec 013/014), for the headline Saving/Debt
    // payoff stats. These stay planning figures, distinct from the checked
    // amounts the bar draws (spec 021).
    savingCents: number;
    debtPayoffCents: number;
  };
  categories: OverviewCategory[];
  // The month's logged expenses for the bottom-of-page ledger (spec 034):
  // `recent` is capped at RECENT_EXPENSES, newest first (same order
  // `getExpensesMonth` already returns); `count` is the real number logged,
  // so the UI knows whether a "View all" link is needed. The total stays
  // `cashFlow.expensesCents` — never resummed from this capped list.
  expenses: { recent: ExpenseLine[]; count: number };
  // Saving/Debt payoff goals for the month (spec 015 — Overview's Goals
  // card), same shape `getGoalsMonth`/`getBudget` already produce.
  goals: OverviewGoal[];
  // Warnings, funded-but-unchecked goals, Assign-unallocated, and (this month
  // only) the permanent reminders to log expenses and keep income and bills
  // current (spec 032) — this month's to-do list, not just what's wrong.
  tasks: Task[];
};

const LARGEST_BILLS = 5;
const RECENT_EXPENSES = 10;

// Everything the Overview page shows, composed from the budget, income and
// bills queries so its numbers cannot drift from the Plan pages. Unallocated is
// always income minus bills, expenses and checked-off goals, the same
// definition as the Plan summary bar (spec 022).
export async function getOverview(
  ctx: HouseholdContext,
  month: string,
): Promise<Overview> {
  const [budget, income, bills, expenses] = await Promise.all([
    getBudget(ctx, month),
    getIncomeMonth(ctx, month),
    getBillsMonth(ctx, month),
    getExpensesMonth(ctx, month),
  ]);
  const currency = ctx.household.currency;

  const categories: OverviewCategory[] = budget.categories.map((c) => ({
    id: c.id,
    name: c.name,
    budgetedCents: c.amountCents,
    billsCents: c.billsCents,
    expensesCents: c.expensesCents,
    leftCents: c.remainingCents,
  }));

  const sources = income.members.flatMap((m) => m.sources);
  const sum = (kind: "fixed" | "variable") =>
    sources.filter((s) => s.kind === kind).reduce((t, s) => t + s.amountCents, 0);

  const incomeCents = budget.incomeCents;
  // Everything earmarked: Expense budgets and goal amounts alike (spec 014).
  const budgetedCents = budget.totalCents + budget.goalsTotalCents;
  const unallocatedCents = budget.unallocatedCents;
  const sumGoalsByType = (type: GoalType) =>
    budget.goals.filter((g) => g.type === type).reduce((t, g) => t + g.amountCents, 0);
  const sumCheckedByType = (type: GoalType) =>
    budget.goals.filter((g) => g.type === type && g.checked).reduce((t, g) => t + g.amountCents, 0);
  const savingCents = sumGoalsByType("saving");
  const debtPayoffCents = sumGoalsByType("debt payoff");
  const checkedSavingCents = sumCheckedByType("saving");
  const checkedDebtPayoffCents = sumCheckedByType("debt payoff");

  // Shared with the Plan summary's compact tasks row (spec 033), so the two
  // can never disagree.
  const tasks = buildTasks(budget, month);

  return {
    month,
    currency,
    householdName: ctx.household.name,
    editable: budget.editable,
    incomeProvisional: budget.incomeProvisional,
    income: {
      totalCents: income.totalCents,
      fixedCents: sum("fixed"),
      variableCents: sum("variable"),
      byMember: income.members
        .filter((m) => m.totalCents > 0 || m.memberId !== null)
        .map((m) => ({ memberId: m.memberId, name: m.name, totalCents: m.totalCents })),
    },
    bills: {
      totalCents: bills.totalCents,
      byCategory: bills.categories,
      largest: [...bills.bills]
        .sort((a, b) => b.monthlyCents - a.monthlyCents || a.name.localeCompare(b.name))
        .slice(0, LARGEST_BILLS)
        .map((b) => ({
          id: b.id,
          name: b.name,
          categoryName: b.categoryName,
          monthlyCents: b.monthlyCents,
          amountCents: b.amountCents,
          intervalMonths: b.intervalMonths,
        })),
    },
    budget: { budgetedCents, unallocatedCents },
    cashFlow: {
      incomeCents,
      billsCents: budget.billsTotalCents,
      expensesCents: budget.expensesTotalCents,
      checkedSavingCents,
      checkedDebtPayoffCents,
      unallocatedCents: Math.max(unallocatedCents, 0),
      overAllocatedCents: Math.max(-unallocatedCents, 0),
      savingCents,
      debtPayoffCents,
    },
    categories,
    expenses: { recent: expenses.expenses.slice(0, RECENT_EXPENSES), count: expenses.expenses.length },
    goals: budget.goals,
    tasks,
  };
}
