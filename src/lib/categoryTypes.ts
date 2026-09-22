// Category type constants and grouping (spec 012), split out from
// `categories.ts` because that file pulls in the database client and cannot
// be imported by client components (CategoryManager, BudgetEditor).

// What kind of budget line a category is. A classification, not a monetary
// amount: changing it is not time-versioned, unlike allocations.
export const CATEGORY_TYPES = ["spending", "saving", "debt payoff"] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

export const TYPE_LABELS: Record<CategoryType, string> = {
  spending: "Spending",
  saving: "Saving",
  "debt payoff": "Debt payoff",
};

// Splits position-ordered lines into Spending / Saving / Debt payoff
// sections, in that order, dropping any section with nothing in it. Shared
// by the Budget page and the Overview category table so both group the same
// way.
export function groupByType<T extends { type: string }>(
  lines: T[],
): { type: CategoryType; label: string; lines: T[] }[] {
  return CATEGORY_TYPES.map((type) => ({
    type,
    label: TYPE_LABELS[type],
    lines: lines.filter((l) => l.type === type),
  })).filter((g) => g.lines.length > 0);
}
