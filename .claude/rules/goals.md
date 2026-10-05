---
paths:
  - "src/lib/{goals,goalTypes}.ts"
  - "src/app/api/goals/**"
  - "src/app/goals/**"
  - "src/components/{GoalEditor,GoalManager}.tsx"
  - "src/components/overview/GoalsCard.tsx"
  - "tests/goals*.test.*"
  - "e2e/goals.spec.ts"
---

# Goals

- Goals (`src/lib/goals.ts`): `saving` | `debt payoff`, separate tables `goals`/`goal_amounts`/`goal_checkins`. `goal_amounts` is time-versioned like `budget_allocations`; `goal_checkins` is a presence record — any month can be checked, including past ones. `goals.note` is optional free text (trimmed, capped at 200 chars via `parseLabel`, spec 040), edited in `GoalManager` where name/type/note are drafted locally and committed together via one Save button per row (not per-field auto-save), and shown read-only under the goal's name in `GoalEditor`'s month-by-month checklist; not surfaced on the Hub's `GoalsCard`. `GOAL_TYPES`/`TYPE_LABELS`/`groupByType` live in `src/lib/goalTypes.ts` (no DB import, for client components). `GoalEditor` calls `router.refresh()` after a successful check-off toggle or amount save so the server-rendered Plan summary stays current (spec 024).
