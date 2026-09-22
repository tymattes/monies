import { getBillsMonth } from "./bills";
import { getBudget } from "./budgets";
import type { GoalType } from "./goalTypes";
import type { HouseholdContext } from "./household";
import { getIncomeMonth } from "./income";
import { formatMoney } from "./money";
import { currentMonth } from "./months";

export type AttentionCode =
  | "over_allocated"
  | "bills_exceed_income"
  | "category_bills_over_budget"
  | "unallocated"
  | "no_income"
  | "no_bills"
  | "goal_not_checked";

export type AttentionItem = {
  code: AttentionCode;
  severity: "warning" | "info";
  message: string;
  href: string;
  actionLabel: string;
  amountCents?: number;
  categoryId?: string;
  goalId?: string;
};

export type OverviewCategory = {
  id: string;
  name: string;
  budgetedCents: number;
  billsCents: number;
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
  // Splits the month's income for the stacked bar. `billsWithinBudgetCents +
  // restOfBudgetCents` always equals the Expense budgeted total (goals are
  // never billed, so they never enter this split); `unallocatedCents` is
  // income minus bills/expenses/checked goals when positive,
  // `overAllocatedCents` when negative. (The bar itself is rebuilt around
  // real terms in spec 021; until then it still draws the budgeted split.)
  cashFlow: {
    incomeCents: number;
    billsWithinBudgetCents: number;
    restOfBudgetCents: number;
    unallocatedCents: number;
    overAllocatedCents: number;
    leftAfterBillsCents: number;
    // Full amounts by goal type (spec 013/014), for the headline Saving/Debt
    // payoff stats. Goals have no bills, so unlike a category these are
    // already the "unbilled" amount — see rest* below.
    spendingCents: number;
    savingCents: number;
    debtPayoffCents: number;
    // What the bar actually draws for the non-bill portion. For Expenses
    // this is `restOfBudgetCents` (there is only one type of category now);
    // for goals it's identical to the full amount above, since a goal is
    // never partly consumed by a bill the way a category can be.
    restSpendingCents: number;
    restSavingCents: number;
    restDebtPayoffCents: number;
  };
  categories: OverviewCategory[];
  // Saving/Debt payoff goals for the month (spec 015 — Overview's Goals
  // card), same shape `getGoalsMonth`/`getBudget` already produce.
  goals: OverviewGoal[];
  attention: AttentionItem[];
};

const LARGEST_BILLS = 5;

// Everything the Overview page shows, composed from the budget, income and
// bills queries so its numbers cannot drift from the Plan pages. Unallocated is
// always income minus budgeted, the same definition as the Plan summary bar.
export async function getOverview(
  ctx: HouseholdContext,
  month: string,
): Promise<Overview> {
  const [budget, income, bills] = await Promise.all([
    getBudget(ctx, month),
    getIncomeMonth(ctx, month),
    getBillsMonth(ctx, month),
  ]);
  const currency = ctx.household.currency;
  const money = (cents: number) => formatMoney(cents, currency);
  const q = month === currentMonth() ? "" : `?month=${month}`;

  const categories: OverviewCategory[] = budget.categories.map((c) => ({
    id: c.id,
    name: c.name,
    budgetedCents: c.amountCents,
    billsCents: c.billsCents,
    leftCents: c.remainingCents,
  }));

  const sources = income.members.flatMap((m) => m.sources);
  const sum = (kind: "fixed" | "variable") =>
    sources.filter((s) => s.kind === kind).reduce((t, s) => t + s.amountCents, 0);

  const billsWithinBudgetCents = categories.reduce(
    (t, c) => t + Math.min(c.billsCents, c.budgetedCents),
    0,
  );
  const restOfBudgetCents = categories.reduce(
    (t, c) => t + Math.max(c.budgetedCents - c.billsCents, 0),
    0,
  );
  const incomeCents = budget.incomeCents;
  // Everything earmarked: Expense budgets and goal amounts alike (spec 014).
  const budgetedCents = budget.totalCents + budget.goalsTotalCents;
  const unallocatedCents = budget.unallocatedCents;
  const spendingCents = budget.totalCents;
  const restSpendingCents = restOfBudgetCents;
  const sumGoalsByType = (type: GoalType) =>
    budget.goals.filter((g) => g.type === type).reduce((t, g) => t + g.amountCents, 0);
  const savingCents = sumGoalsByType("saving");
  const debtPayoffCents = sumGoalsByType("debt payoff");

  const attention: AttentionItem[] = [];
  // Income that may still grow (variable deposits not recorded yet) makes a
  // shortfall informational rather than an error.
  const provisional = budget.incomeProvisional;
  const shortfallSeverity = provisional ? "info" : "warning";
  const note = provisional ? " Variable income counts once you record it." : "";
  if (incomeCents > 0 && unallocatedCents < 0) {
    attention.push({
      code: "over_allocated",
      severity: shortfallSeverity,
      message: provisional
        ? `Bills, expenses and checked-off goals exceed the income recorded so far by ${money(-unallocatedCents)}.${note}`
        : `Bills, expenses and checked-off goals exceed your income by ${money(-unallocatedCents)}.`,
      href: `/budget${q}`,
      actionLabel: "Review budget",
      amountCents: -unallocatedCents,
    });
  }
  if (incomeCents > 0 && budget.billsTotalCents > incomeCents) {
    attention.push({
      code: "bills_exceed_income",
      severity: shortfallSeverity,
      message: provisional
        ? `Bills (${money(budget.billsTotalCents)}) are more than the income recorded so far (${money(incomeCents)}).${note}`
        : `Bills (${money(budget.billsTotalCents)}) are more than your income (${money(incomeCents)}).`,
      href: `/bills${q}`,
      actionLabel: "Review bills",
      amountCents: budget.billsTotalCents - incomeCents,
    });
  }
  for (const c of categories) {
    if (c.billsCents > c.budgetedCents) {
      attention.push({
        code: "category_bills_over_budget",
        severity: "warning",
        message: `${c.name}: bills are ${money(c.billsCents - c.budgetedCents)} over its budget.`,
        href: `/budget${q}`,
        actionLabel: "Adjust budget",
        amountCents: c.billsCents - c.budgetedCents,
        categoryId: c.id,
      });
    }
  }
  if (budget.editable && unallocatedCents > 0) {
    attention.push({
      code: "unallocated",
      severity: "info",
      message: `${money(unallocatedCents)} is not assigned to a category yet.`,
      href: `/income${q}#assign`,
      actionLabel: "Assign",
      amountCents: unallocatedCents,
    });
  }
  // Setup gaps only matter for months you can still change.
  if (budget.editable && incomeCents === 0) {
    attention.push({
      code: "no_income",
      severity: "info",
      message: "No income yet this month.",
      href: `/income${q}`,
      actionLabel: "Add income",
    });
  }
  if (budget.editable && bills.bills.length === 0) {
    attention.push({
      code: "no_bills",
      severity: "info",
      message: "No recurring bills yet.",
      href: `/bills${q}`,
      actionLabel: "Add bills",
    });
  }
  // A reminder to confirm a funded goal actually happened (spec 015). Only
  // for the current month: a past month is for review, and a future month
  // has nothing to confirm yet (the checkmark records something that already
  // happened), same reasoning as the setup prompts above.
  if (month === currentMonth()) {
    for (const g of budget.goals) {
      if (g.amountCents > 0 && !g.checked) {
        attention.push({
          code: "goal_not_checked",
          severity: "info",
          message: `${g.name} hasn't been checked off yet this month.`,
          href: "/goals",
          actionLabel: "Check off",
          amountCents: g.amountCents,
          goalId: g.id,
        });
      }
    }
  }

  return {
    month,
    currency,
    householdName: ctx.household.name,
    editable: budget.editable,
    incomeProvisional: provisional,
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
      billsWithinBudgetCents,
      restOfBudgetCents,
      unallocatedCents: Math.max(unallocatedCents, 0),
      overAllocatedCents: Math.max(-unallocatedCents, 0),
      leftAfterBillsCents: incomeCents - budget.billsTotalCents,
      spendingCents,
      savingCents,
      debtPayoffCents,
      restSpendingCents,
      restSavingCents: savingCents,
      restDebtPayoffCents: debtPayoffCents,
    },
    categories,
    goals: budget.goals,
    attention,
  };
}
