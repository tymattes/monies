# 033: Plan summary shows this month's tasks

**Status:** draft

## Goal

Usability testing found that the summary card at the top of every Plan page (Budget, Bills, Income, Goals) shows only Income/Budgeted/Unallocated and an Assign button, so a household working in Plan has to go back to Overview to see what's still outstanding this month. Show the same open tasks there — assign-unallocated among them, spec 032 — in a compact form that fits the card, without duplicating or drifting from Overview's own Tasks logic.

## Requirements

- The Plan summary card (`PlanSummary`, shown via `PlanHeader` on all four Plan pages) shows the current month's open tasks below its three stats, sourced from the same task-building logic Overview's Tasks list uses (spec 032) — not a second implementation that can disagree with it.
- Tasks render compactly — short link chips, not Overview's full sentences — since the card already carries three stats and needs to stay a header, not a second Tasks section.
- Category-over-budget tasks collapse into a single chip ("N categories over budget," linking to Budget) here, rather than Overview's one-per-category — the only place this spec simplifies what Overview shows in full.
- Assign-unallocated is one of these task chips, linking to `/goals?month=...#assign` — it's no longer a distinct button styled apart from the rest (folding it in is the point: "make Assign a task, not a special case").
- The three permanent monthly reminders (Log expenses, Update income, Update bills) and the goal-check-off reminder appear here too, under the same current-month-only scoping as Overview (spec 032).
- When there are no open tasks for the month, the tasks row is omitted; the card still shows its three stats as today.
- Past and future months never show the three permanent reminders, matching Overview.

## Out of scope

- Changing the three headline stats (Income, Budgeted, Unallocated) themselves.
- Overview's own Tasks list or its per-category detail — unchanged by this spec.

## Acceptance criteria

- [ ] Every Plan page's summary card shows a row of task chips for the current month when any are open.
- [ ] The chip set matches Overview's Tasks for the same month, except category-over-budget is one combined chip here.
- [ ] Assign shows as a task chip like any other, not a separate button.
- [ ] A month with no open tasks shows the card with no tasks row.
- [ ] A past or future month never shows the three permanent reminders.
- [ ] Documentation updated (see Documentation).

## Technical notes

- Extract the task-building logic added in spec 032 into a pure function taking a `Budget` and a `month` (everything it needs — `editable`, `incomeCents`, `unallocatedCents`, `billsTotalCents`, `categories`, `goals` — is already on `Budget`, `src/lib/budgets.ts`) and returning the task list. `getOverview` (`src/lib/overview.ts`) calls it for the full list; `planSummaryFromBudget`/`getPlanSummary` (`src/lib/plan.ts`) call it for this one, so both stay in sync by construction.
- `PlanSummaryData` (`src/lib/plan.ts`) gains a `tasks` field carrying this list (or the simplified/collapsed form — decide whether collapsing category-over-budget happens in the shared builder with a `compact` flag, or as a presentation step in `PlanSummary.tsx`; either is fine as long as Overview's per-category detail is untouched).
- `src/components/PlanSummary.tsx`: renders the tasks as a row of small links below the stats grid; the `assign: "scroll" | "link"` prop and its dedicated Assign button are removed now that Assign is just another task chip. `assign="scroll"` was already unused by every call site (`grep` shows only `"link"` in production code) — confirm before deleting the mode and its now-orphaned test cases in `tests/plan-ui.test.tsx`.
- Callers of `PlanSummary` (`PlanHeader.tsx`, `BudgetEditor.tsx`) drop the `assign` prop.

## Documentation

- `README.md`: "Plan area" bullet — replace "an Assign button in the bar takes you to the Assign panel" with a description of the tasks row, of which Assign is one.

## Verification

- `npx vitest run tests/plan-ui.test.tsx tests/overview.test.ts`
- Manual: with open tasks (e.g. unallocated income and an unchecked goal), confirm the same tasks appear on Overview and on every Plan page's summary card, and that a category-over-budget situation shows as one combined chip on Plan but per-category on Overview.
