# Specs

Monies is built spec-first. `brief.md` is the source of truth for product intent; every feature or change gets its own numbered spec before any code is written.

## Workflow

1. Copy `_template.md` to `NNN-short-name.md` (next unused number) and set Status to `draft`.
2. Fill it in and review it. Once agreed, set Status to `approved`.
3. Implement against the acceptance criteria. Keep the spec updated if scope changes.
4. Update the docs in the same PR: `README.md` (features, config, commands, deploy notes, tech stack) and `CLAUDE.md`. Each spec lists what changes under its Documentation section.
5. When every acceptance box, including docs, is checked and verification passes, set Status to `implemented`.
6. Deliver each spec on its own feature branch (e.g. `feat/003-households`) via a pull request; never commit directly to `main`.

## Index

| # | Spec | Status |
| --- | --- | --- |
| 001 | [App shell](001-app-shell.md) | implemented |
| 002 | [Database foundation and README](002-database-and-readme.md) | implemented |
| 003 | [Households and members](003-households.md) | implemented |
| 004 | [Categories and monthly budgets](004-categories-and-budgets.md) | implemented |
| 005 | [Light and dark theme](005-theming.md) | implemented |
| 006 | [Income per member](006-income.md) | implemented |
| 007 | [Bills, assign-to-savings, Dracula theme](007-bills-and-budget-polish.md) | implemented |
| 008 | [Overview page and grouped Plan area](008-overview-and-plan.md) | implemented |
| 009 | [Browser testing with Playwright](009-browser-testing.md) | implemented |
| 010 | [Provisional income for months in progress](010-provisional-income.md) | implemented |
| 011 | [UI polish: separate the panes and tables](011-ui-polish.md) | implemented |
| 012 | [Category types: spending, saving, debt payoff](012-category-types.md) | implemented |
| 013 | [Saving and Debt payoff totals on the Overview cash-flow card](013-overview-saving-debt-totals.md) | implemented |
| 014 | [Savings and Debt payoff as goals, separate from budgets](014-savings-debt-goals.md) | implemented |
| 015 | [Goals under Plan, Assign moves to Income, a check-off reminder, a Goals overview card, "Unallocated Income"](015-plan-goals-and-assign-on-income.md) | implemented |
| 016 | [Allocation UX — informed splits, a cleaner Assign panel](016-allocation-ux.md) | implemented |
| 017 | [Assign is a one-month top-up, not a permanent raise](017-assign-one-month-topup.md) | implemented |
| 018 | [Resume browser testing and reconcile the e2e suite](018-resume-browser-tests.md) | implemented |
| 019 | [Expenses — logging actual spend against a category](019-expenses.md) | implemented |
| 020 | [Assign no longer targets a budget category directly](020-assign-goals-only.md) | implemented |
| 021 | [Overview shows budget vs. actual](021-overview-budget-vs-actual.md) | implemented |
| 022 | [Unallocated reflects commitments, not plans](022-unallocated-reflects-commitments.md) | implemented |
| 023 | [Overview sections — Budget, Expenses, and per-domain actions](023-overview-sections-and-actions.md) | implemented |
| 024 | [Goals page refreshes the Plan summary after check-off and amount edits](024-goals-refresh-plan-summary.md) | implemented |
| 025 | [Unallocated wording and a goals step in the get-started checklist](025-unallocated-wording-and-goals-onboarding.md) | implemented |
| 026 | [Assign confirms what happened and that money is claimed at check-off](026-assign-claims-on-checkoff-copy.md) | implemented |
| 027 | [Expense description belongs inside the entry form](027-expense-description-in-form.md) | draft |
| 028 | [Common currencies first in the setup currency picker](028-currency-picker-common-first.md) | implemented |
| 029 | [Plan tabs match the onboarding order](029-plan-tabs-match-onboarding-order.md) | implemented |
| 030 | [Set a fixed source's amount when you add it](030-income-amount-on-creation.md) | implemented |
| 031 | [A persistent set-up checklist on Overview](031-persistent-onboarding-checklist.md) | implemented |
| 032 | [Needs attention becomes Tasks, and Assign moves to Goals](032-tasks-and-assign-on-goals.md) | implemented |
| 033 | [Plan summary shows this month's tasks](033-plan-summary-tasks.md) | implemented |
| 034 | [Overview shows a recent-expenses ledger instead of a total-only card](034-overview-recent-expenses.md) | implemented |
| 035 | [Overview's Tasks can be completed inline](035-overview-tasks-inline-actions.md) | implemented |
| 036 | [The Overview page is renamed "Hub"](036-overview-becomes-hub.md) | implemented |
| 037 | [Header nav polish — accent underline, bigger touch targets, a Plan hint](037-header-nav-polish.md) | implemented |
| 038 | [Budget page shows Expenses, like Bills, and "Left" becomes "Remaining"](038-budget-page-expenses-column.md) | implemented |
| 039 | [Hub cards — honest bars, less duplication](039-hub-card-bar-cleanup.md) | implemented |
| 040 | [Notes on Goals](040-goal-notes.md) | implemented |
| 041 | [Support multiple owners](041-multiple-owners.md) | implemented |
