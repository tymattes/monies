# 029: Plan tabs match the onboarding order

**Status:** implemented

## Goal

Usability testing (owner, manual pass through a fresh instance) found that the Plan tab order — Budget, Bills, Income, Goals — doesn't match the order a new household is guided through on Overview's set-up checklist: Income, Budget, Bills, Goals. Income comes first there because you can't meaningfully set a budget without knowing what you have to work with, but Plan currently opens on Budget. Reorder Plan to match, so there's one order to learn, not two.

## Requirements

- `PlanTabs` renders the tabs in the order Income, Budget, Bills, Goals.
- The header's **Plan** destination (`HeaderNav`) links to `/income` instead of `/budget`, so it lands on the same first step the tabs and the onboarding checklist (spec 031) both lead with.
- Route paths are unchanged (`/budget`, `/bills`, `/income`, `/goals` stay as they are) — this is tab order and the Plan landing page only, not a URL restructure.
- `PlanTabs`' active-tab detection (`pathname === t.href`) is unaffected by reordering the array.

## Out of scope

- Changing route slugs or page titles.
- Reordering content within an individual Plan page.
- The onboarding checklist itself (already in this order; see spec 031).

## Acceptance criteria

- [x] `PlanTabs` shows Income, Budget, Bills, Goals, left to right.
- [x] The header's Plan link points at `/income`.
- [x] Each tab still highlights correctly for its own page and keeps the month query string.
- [x] Documentation updated (see Documentation).

## Technical notes

- `src/components/PlanTabs.tsx`: reorder the `TABS` array.
- `src/components/HeaderNav.tsx`: change the Plan item's `href` from `/budget` to `/income`; `PLAN_PATHS` (used only for active-state membership) is unaffected by order.
- `tests/plan-ui.test.tsx` asserts tab order and `href="/budget"` for the Plan nav link — both need updating.

## Documentation

- `CLAUDE.md`: Navigation bullet — "Plan (opens `/budget`; active on `/budget`, `/bills`, `/income`, `/goals`)" → opens `/income`; "Budget | Bills | Income | Goals are `PlanTabs`" → "Income | Budget | Bills | Goals are `PlanTabs`".
- `README.md`: "Plan area" bullet — "Budget, Bills, Income and Goals are four tabs" → "Income, Budget, Bills and Goals are four tabs".

## Verification

- `npx vitest run tests/plan-ui.test.tsx`
- Manual: open Plan from the header on a fresh household, confirm it opens Income; click through all four tabs in order.
