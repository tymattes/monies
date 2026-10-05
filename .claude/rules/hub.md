---
paths:
  - "src/lib/{overview,tasks,plan}.ts"
  - "src/app/**/page.tsx"
  - "src/app/layout.tsx"
  - "src/app/api/overview/**"
  - "src/components/overview/**"
  - "src/components/{Header,HeaderNav,PlanHeader,PlanTabs,PlanSummary,MonthNav}.tsx"
  - "tests/{overview,overview-ui,plan,plan-ui}.test.*"
  - "e2e/{overview,plan,layout}.spec.ts"
---

# Hub (Overview), Tasks, the Plan summary and navigation

## Tasks

- `buildTasks` in `src/lib/tasks.ts` (`TaskCode`/`Task`, spec 032) builds this month's to-do list purely from a `Budget`, so it never needs its own query.
- Conditional codes: the warnings `over_allocated`, `bills_exceed_income` and `category_over_budget`, plus `unallocated` (Assign, linking to `/goals...#assign`) and `goal_not_checked`. Permanent codes: `log_expenses`/`update_income`/`update_bills` show every current month regardless of what's already done.
- One function, two callers, so the lists can't drift apart. `getOverview` (`src/lib/overview.ts`) uses it for Overview's full list. `planSummaryFromBudget` (`src/lib/plan.ts`) uses it for the Plan summary's compact one and collapses multiple `category_over_budget` items into one via `collapseCategoryOverBudget`; that is the only place Plan shows less than Overview (spec 033).

## Overview

- `/`, `getOverview`, `GET /api/overview/[month]`: read-only results for a month. `getOverview` is the single source for both page and API and composes `getBudget`, `getIncomeMonth`, `getBillsMonth`, `getExpensesMonth`. Never recompute those numbers in a component.
- `OverviewCategory` carries `expensesCents` alongside bills/budgeted. `category_over_budget` fires on `leftCents < 0`, so bills or expenses alone can flag it.
- The cash-flow bar (`cashFlow` in the same file) draws spec 022's real terms: Bills, checked Saving, checked Debt payoff, Expenses and the Unallocated remainder. The bar and `Budget.unallocatedCents` must never disagree.
- Page sections (specs 023, 034): the Budget table (`CategoryTable.tsx`), a full-width `ExpensesList`, then a 3-column grid of Income, Bills and Goals cards. Each card links out with the verb for its own interaction ("Edit budget", "Add income", "Add bill", "Check off"), not a generic "Manage".
- `Overview.expenses` is `{ recent: ExpenseLine[]; count: number }`. `recent` is `getExpensesMonth`'s rows capped at 10, newest first. `count` is the real number logged, so `ExpensesList` knows whether to show "View all in Expenses". The section groups `recent` by `spentOn` into day headings; its Total row comes from `cashFlow.expensesCents`, never resummed from the capped rows.

## Tasks' inline actions (spec 035)

- `TaskList.tsx` is a client component. Its props beyond `items` (`month`, `currency`, `editable`, `categories`, `goals`) are all already on `Overview`, so it needs no new query.
- Four task codes expand a panel in place instead of rendering a `<Link>`:
  - `goal_not_checked` acts immediately: one `PUT` checkin call, no form.
  - `unallocated` embeds `AssignUnallocated` (the `bare` prop skips its card chrome), gated on `editable`.
  - `log_expenses` renders `TaskQuickExpense.tsx`, a compact `POST /api/expenses` form with no month-clamping, since this task is always the current month.
  - `category_over_budget` renders `TaskQuickBudgetAdjust.tsx`, one amount field that `PUT`s to the allocation route, gated on `editable`.
- Every other task code is a `<Link>` to its page.
- On success each action calls `router.refresh()` and a resolved task drops out of the next `buildTasks` render. Assign is the exception: it only plans a goal's amount, and a goal claims against Unallocated only once checked off (specs 021, 026), so the `unallocated` task persists through a successful Assign by design.
- `page.tsx` gives `TaskList` a `key` on `[month, o.tasks.length]` so expand state never carries into a different month's tasks.
- The card list is a CSS grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`) with `items-start`, not CSS multi-column: expanding a card must only grow its own row and never move other cards (spec 045).
- Expanded cards get a `ring-2 ring-accent` highlight, layered outside the severity-colored left edge.

## Navigation and the Plan header

- `HeaderNav` has four top-level destinations: Overview (`/`), Plan (opens `/income`; active on `/budget`, `/bills`, `/income`, `/goals`), Expenses (`/expenses`) and Household (`/household`; `/members` permanently redirects there, spec 044).
- The active destination gets a `border-accent` underline, matching `PlanTabs`' active-tab treatment. "Plan" carries a static `▾` hint since it opens onto four sub-sections (spec 037).
- `PlanTabs` are Income | Budget | Bills | Goals, in that order to match the Overview set-up checklist (spec 029). `PlanHeader` renders title, `PlanTabs`, `MonthNav`, `PlanSummary`. It is a component, not a layout, because Next.js layouts cannot read `searchParams`.
- `PlanSummary` shows the three headline stats plus this month's open tasks as compact link chips (spec 033), Assign among them rather than a separate button. `PlanSummaryData.tasks` comes from `planSummaryFromBudget`/`getPlanSummary` (`src/lib/plan.ts`). On Budget, `BudgetEditor` renders its own live summary from local state, but `tasks` is still server-given and static like `unallocatedCents`: editing an amount doesn't recompute it.
- Every top-level page carries a one-line description under its title (spec 042). The four Plan tabs take theirs from `PlanHeader`'s `DESCRIPTIONS` table keyed on `title`; Hub, Expenses and Household render theirs inline. Keep this copy consistent with `README.md`'s Philosophy/Features wording; it's a label, so one sentence each.
- `GetStarted` (`src/components/overview/GetStarted.tsx`) has a matching intro line above its steps making clear the checklist is guidance, not a completeness requirement.
