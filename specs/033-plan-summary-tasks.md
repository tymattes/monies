# 033: Plan summary shows this month's tasks

**Status:** approved

## Goal

Usability testing found that the summary card at the top of every Plan page (Budget, Bills, Income, Goals) shows only Income/Budgeted/Unallocated and an Assign button, so a household working in Plan has to go back to Overview to see what's still outstanding this month. Show the same open tasks there — assign-unallocated among them, spec 032 — in a compact form that fits the card, without duplicating or drifting from Overview's own Tasks logic.

## Requirements

- The Plan summary card (`PlanSummary`, shown via `PlanHeader` on all four Plan pages) shows the current month's open tasks below its three stats, sourced from the same task-building logic Overview's Tasks list uses (spec 032) — not a second implementation that can disagree with it.
- Tasks render compactly — short link chips, not Overview's full sentences — since the card already carries three stats and needs to stay a header, not a second Tasks section. Each chip still needs to stand alone at a glance: the Assign chip reads "Assign Income to Goal," and a goal-check-off chip includes the goal's name plus "goal" ("Check off Savings goal"), so two goals due don't render as two identical "Check off" chips.
- Category-over-budget tasks collapse into a single chip ("N categories over budget," linking to Budget) here, rather than Overview's one-per-category — the only place this spec simplifies what Overview shows in full.
- Assign-unallocated is one of these task chips, linking to `/goals?month=...#assign` — it's no longer a distinct button styled apart from the rest (folding it in is the point: "make Assign a task, not a special case").
- The three permanent monthly reminders (Log expenses, Update income, Update bills) and the goal-check-off reminder appear here too, under the same current-month-only scoping as Overview (spec 032).
- When there are no open tasks for the month, the tasks row is omitted; the card still shows its three stats as today.
- Past and future months never show the three permanent reminders, matching Overview.

## Out of scope

- Changing the three headline stats (Income, Budgeted, Unallocated) themselves.
- Overview's own Tasks list or its per-category detail — unchanged by this spec.

## Acceptance criteria

- [x] Every Plan page's summary card shows a row of task chips for the current month when any are open.
- [x] The chip set matches Overview's Tasks for the same month, except category-over-budget is one combined chip here.
- [x] Assign shows as a task chip like any other, not a separate button.
- [x] A month with no open tasks shows the card with no tasks row.
- [x] A past or future month never shows the three permanent reminders.
- [x] Documentation updated (see Documentation).

## Technical notes

- Done: extracted the task-building logic added in spec 032 into `src/lib/tasks.ts` (`buildTasks(budget, month)`, plus `TaskCode`/`Task`), a pure function taking a `Budget` (everything it needs is already on it). `getOverview` (`src/lib/overview.ts`) calls it for the full list; `planSummaryFromBudget`/`getPlanSummary` (`src/lib/plan.ts`) call it for the compact one via `collapseCategoryOverBudget(buildTasks(b, month))` — a second exported function in `tasks.ts` that merges multiple `category_over_budget` items into one, so both places read the same underlying logic and can't drift apart.
- `PlanSummaryData` (`src/lib/plan.ts`) gained the `tasks` field, already collapsed.
- `src/components/PlanSummary.tsx`: renders the tasks as a row of small link chips below the stats grid; the `assign: "scroll" | "link"` prop and its dedicated Assign button are gone — confirmed `"scroll"` was unused by every call site before deleting it and its orphaned tests in `tests/plan-ui.test.tsx`. The component no longer needs `"use client"` (no hooks left).
- Callers of `PlanSummary` (`PlanHeader.tsx`, `BudgetEditor.tsx`) drop the `assign` prop; `src/app/budget/page.tsx` computes `tasks` via `planSummaryFromBudget` and passes it into `BudgetEditor`, which (like `unallocatedCents`) treats it as server-given and static, not recomputed as the user edits amounts.
- One behavior fix that fell out of sharing `buildTasks`: the Assign link now omits `?month=` for the current month, matching every other link in the app — the old hardcoded Income link always included it, inconsistently.

## Documentation

- `README.md`: "Plan area" bullet — replace "an Assign button in the bar takes you to the Assign panel" with a description of the tasks row, of which Assign is one.

## Verification

- `npx vitest run tests/plan-ui.test.tsx tests/overview.test.ts`
- Manual: with open tasks (e.g. unallocated income and an unchecked goal), confirm the same tasks appear on Overview and on every Plan page's summary card, and that a category-over-budget situation shows as one combined chip on Plan but per-category on Overview.
