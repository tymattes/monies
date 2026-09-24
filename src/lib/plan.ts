import { getBudget, type Budget } from "./budgets";
import type { HouseholdContext } from "./household";
import { buildTasks, collapseCategoryOverBudget, type Task } from "./tasks";

// The numbers in the Plan summary bar (Budget, Bills, Income and Goals pages).
// Unallocated is sourced from getBudget (spec 022: income minus bills,
// expenses and checked-off goals), never derived client-side.
export type PlanSummaryData = {
  month: string;
  currency: string;
  editable: boolean;
  incomeCents: number;
  // Income may still grow (variable deposits not recorded yet); see spec 010.
  incomeProvisional: boolean;
  // Expense categories and goals together (spec 014) — the planned total.
  budgetedCents: number;
  // Monthly cost of bills; these sit inside the budgeted amounts.
  billsCents: number;
  // Income minus bills, expenses and checked-off goals (spec 022).
  unallocatedCents: number;
  // This month's open tasks, built the same way as Overview's (spec 032),
  // with category-over-budget collapsed into one chip (spec 033) since this
  // card is a header, not a second Tasks section.
  tasks: Task[];
};

// Pure so the Income page (which needs the full Budget for Assign anyway,
// spec 015) can build its summary from one getBudget call instead of two.
export function planSummaryFromBudget(b: Budget, month: string): PlanSummaryData {
  return {
    month,
    currency: b.currency,
    editable: b.editable,
    incomeCents: b.incomeCents,
    incomeProvisional: b.incomeProvisional,
    budgetedCents: b.totalCents + b.goalsTotalCents,
    billsCents: b.billsTotalCents,
    unallocatedCents: b.unallocatedCents,
    tasks: collapseCategoryOverBudget(buildTasks(b, month)),
  };
}

export async function getPlanSummary(
  ctx: HouseholdContext,
  month: string,
): Promise<PlanSummaryData> {
  const b = await getBudget(ctx, month);
  return planSummaryFromBudget(b, month);
}
