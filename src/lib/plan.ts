import { getBudget } from "./budgets";
import type { HouseholdContext } from "./household";

// The numbers in the Plan summary bar (Budget, Bills and Income pages).
// Unallocated is always income minus budgeted; it is derived, not stored.
export type PlanSummaryData = {
  month: string;
  currency: string;
  editable: boolean;
  incomeCents: number;
  budgetedCents: number;
  // Monthly cost of bills; these sit inside the budgeted amounts.
  billsCents: number;
};

export async function getPlanSummary(
  ctx: HouseholdContext,
  month: string,
): Promise<PlanSummaryData> {
  const b = await getBudget(ctx, month);
  return {
    month,
    currency: b.currency,
    editable: b.editable,
    incomeCents: b.incomeCents,
    budgetedCents: b.totalCents,
    billsCents: b.billsTotalCents,
  };
}
