// Goal type constants and grouping (spec 014), split out from `goals.ts`
// because that file pulls in the database client and cannot be imported by
// client components (GoalManager, GoalEditor).

// A goal is either building toward Saving or paying down Debt. A
// classification, not a monetary amount: changing it is not time-versioned,
// unlike a goal's amount.
export const GOAL_TYPES = ["saving", "debt payoff"] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const TYPE_LABELS: Record<GoalType, string> = {
  saving: "Saving",
  "debt payoff": "Debt payoff",
};

// Splits position-ordered goals into Saving / Debt payoff sections, in that
// order, dropping any section with nothing in it.
export function groupByType<T extends { type: string }>(
  lines: T[],
): { type: GoalType; label: string; lines: T[] }[] {
  return GOAL_TYPES.map((type) => ({
    type,
    label: TYPE_LABELS[type],
    lines: lines.filter((l) => l.type === type),
  })).filter((g) => g.lines.length > 0);
}
