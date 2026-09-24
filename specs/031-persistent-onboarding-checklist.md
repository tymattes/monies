# 031: A persistent set-up checklist on Overview

**Status:** approved

## Goal

Usability testing found that Overview's set-up guide (`GetStarted`) is all-or-nothing: it replaces the entire page until income, a budget and bills are all non-zero, then disappears for good. A household that's added income but nothing else loses all guidance on what's left, and the switch from "guide" to "your numbers" happens with no in-between. Keep a compact checklist at the top of Overview, with a checkmark for each step already done, until every step is done — so the guide and the real numbers are visible together while you're still setting up.

## Requirements

- Overview always renders its normal content (Tasks, cash flow, budget table, the four cards) — the full-page swap to a set-up-only view is removed.
- A checklist section appears above that content whenever at least one step isn't done yet, in the same order as the Plan tabs (spec 029): Add your income, Set your category budgets, Add your recurring bills, Review your goals. Each step links to its page, as today.
- A step shows a checkmark once it's done; an undone step keeps today's numbered-circle style.
- Step "done" criteria, computed from data `getOverview` already loads (no new queries):
  - Income: `income.totalCents > 0`.
  - Budget: at least one category has a non-zero budgeted amount.
  - Bills: `bills.totalCents > 0`.
  - Goals: at least one goal has a non-zero amount for the month (matches the existing check-off reminder's own gate, spec 015 — a household's starter goal exists by default but starts at $0, so its mere existence doesn't count as "reviewed").
- The checklist section is omitted entirely once every step is done — same finish line as today, now visible as progress instead of a single jump.

## Out of scope

- Dismissing or hiding the checklist manually before it's complete.
- Changing what each step's linked page does.
- The Tasks list (formerly Needs attention) and its own reminders — spec 032.

## Acceptance criteria

- [x] A brand-new household sees the checklist plus the rest of Overview (at its zeroed starting values), not a page swap.
- [x] Each step shows a checkmark once its own done-criterion is met, independent of the others.
- [x] The checklist disappears once income, a budget, bills and a goal amount are all in place.
- [x] Overview's other sections render the same way regardless of checklist progress.
- [x] Documentation updated (see Documentation).

## Technical notes

- `src/components/overview/GetStarted.tsx`: reworked to take the pieces of `Overview` needed to compute each step's done state (or the whole `Overview`), rendering `null` when every step is done instead of being conditionally mounted by the page.
- `src/app/page.tsx`: drop the `empty` boolean and its branch; always render `<GetStarted />` followed by the rest of the page.
- Reuses `Overview.income.totalCents`, `Overview.categories`, `Overview.bills.totalCents`, `Overview.goals` — all already returned by `getOverview` (`src/lib/overview.ts`), so this is presentation-only, no new data.

## Documentation

- `README.md`: Overview bullet — "A brand-new household gets a short set-up guide instead" → describes the persistent checklist with checkmarks that sits above the rest of the page until every step is done.

## Verification

- `npx vitest run tests/overview.test.ts tests/overview-ui.test.tsx`
- Manual: on a fresh household, confirm the checklist and the (zeroed) rest of Overview both show; add income only and confirm just that step checks off; finish all four and confirm the checklist disappears.
