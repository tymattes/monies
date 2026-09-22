# 014: Savings and Debt payoff as goals, separate from budgets

**Status:** implemented

## Goal
Spec 012 modeled Saving and Debt payoff as category *types*, living in the
same `categories`/`budget_allocations` tables as ordinary spending
categories, grouped into sections on the Budget page and Overview. In
practice these aren't the same kind of thing: an Expense category is money
you plan to spend and can verify against real transactions (once spec 015
adds those); a Savings or Debt payoff line is a transfer that happens
outside this app entirely (your bank, your brokerage, your creditor) — the
app can never observe whether it actually happened, only whether you say it
did. This spec gives Saving and Debt payoff their own model — **goals**: a
name, a monthly target amount you can still change like any budget figure,
and a simple checkmark for "did I do this." It fully replaces category
`type` (dropped back to Expense-only categories) rather than running both
systems side by side, including migrating the household's existing Saving
categories. This is prerequisite groundwork for spec 015 (Expenses &
Transactions), which only needs to reason about one kind of category.

## Requirements
- **Goals.** A goal has a name, a type (`saving` or `debt payoff`), a
  position (reorderable), and is archivable — all the same shape
  `categories` already has, but its own table. Every household member can
  create, rename, reorder, and archive goals (same permission model as
  categories).
- **Monthly amount.** A goal's target amount is time-versioned exactly like
  a budget allocation: editable from the current month onward, later months
  inherit it until changed, past months are read-only. This is the "still
  have the ability to change the amount each month" requirement.
- **Monthly checkmark.** A goal can be marked done for a given month,
  independent of its amount. Unlike the amount, the checkmark is editable
  for *any* month, past included — it records a fact ("I made this
  transfer"), not a plan, and someone might confirm it after the month
  closes.
- **A dedicated page** (`/goals`, new top-level nav item "Goals", 4th
  destination alongside Overview/Plan/Members) lists goals as cards —
  grouped Saving / Debt payoff — each showing the month's target amount
  (editable), the checkmark, and month navigation like every other Plan
  page.
- **Categories go back to Expense-only.** `type` is removed from
  `categories`; the Budget page and Overview's categories table drop the
  Spending/Saving/Debt payoff grouping added in spec 012 (there is only one
  group now, so a group header is pointless). The Category manager drops
  its type selector.
- **Unallocated still means the same thing everywhere.** Income minus
  everything earmarked — Expense category budgets *and* goal amounts. The
  Budget/Bills/Income Plan summary bar and the Overview must show the exact
  same Unallocated figure they always have, now inclusive of goals even
  though goals aren't edited on those pages.
- **Assign unallocated can target goals too.** The Assign panel on the
  Budget page lists both Expense categories and goals as targets, still
  preselecting the first Saving goal by default when one exists (carrying
  forward the behavior from specs 007/012), still never defaulting Debt
  payoff.
- **Overview keeps its Saving/Debt payoff figures**, from spec 013 — the
  headline stats and the bar's type split — just sourced from goals instead
  of category types. Their visibility rules (hidden at $0.00 / when nothing
  to split) are unchanged.
- **Starter data.** A brand-new household gets a starter "Savings" *goal*
  (type `saving`, $0 to start) instead of a starter "Savings" *category*,
  keeping the same out-of-the-box feel spec 004 intended.
- **Migration.** The real household's existing Saving categories (KT
  Brokerage, KT Roth IRA, Ridge 529, Ridge UTMA Brokerage, Marcus High
  Yield) move into `goals` automatically on deploy, keeping their name,
  position, and full amount history — nothing to redo by hand.

## Out of scope
- Everything in spec 015 (Expenses & Transactions): manual expense entry,
  budget-vs-actual for Expense categories. This spec only clears the ground
  for it.
- Receipt capture and automatic categorization — already deferred, not
  reopened here.
- Any "actual vs. goal" comparison for Saving/Debt payoff beyond the
  checkmark. There is nothing to compare against (no transaction the app
  can see), by design (see Goal in the main spec doc above).
- Tracking real account balances (what your Roth IRA is actually worth).
  This is still just a monthly target and a checkmark, same limit spec 012
  already had.
- A goal-level note/description field, reminders, or notifications for an
  unchecked goal. Can follow later if wanted.

## Acceptance criteria
- [x] `goals`, `goal_amounts`, `goal_checkins` tables exist; a goal's amount
      is time-versioned (current-month-onward, past read-only) exactly like
      a budget allocation; a checkmark can be set/cleared for any month,
      including past ones (covered by tests).
- [x] The migration moves every existing `saving`/`debt payoff` category
      into `goals` with its full amount history, then drops `type` from
      `categories` entirely; applying it to the real household's data
      (verified via a copy) preserves all 5 existing goals and their
      amounts exactly.
- [x] `/goals` lists goals grouped by type with month navigation, an
      editable amount per goal, and a checkbox that can be toggled for any
      month; add/rename/reorder/archive all work (covered by tests and in
      the browser).
- [x] The Budget page and Overview categories table no longer show a
      Spending/Saving/Debt payoff grouping — a flat list, as before spec
      012 (covered by render tests).
- [x] Unallocated (Plan summary bar, Overview) equals income minus Expense
      budgets minus goal amounts, identically on every page that shows it
      (covered by tests comparing the API responses directly, the way spec
      008's invariant is already tested).
- [x] Assign-unallocated can send money to a goal or a category in the same
      request; the first row still preselects the first Saving goal when
      one exists (covered by tests, replacing the spec-012 category-based
      version).
- [x] The Overview's Saving/Debt payoff stats and bar segments match the
      goals' amounts, not categories' (covered by tests).
- [x] A new household gets a starter "Savings" goal, not category (covered
      by a test).
- [x] Documentation updated (see Documentation).

## Technical notes
- **Schema** (new migration): `goals` (id, household_id, name, type check
  `in ('saving','debt payoff')`, position, start_month, archived_from,
  created_at — same shape and indexes as `categories`); `goal_amounts`
  (id, goal_id, effective_month, amount_cents, created_by, created_at —
  same shape as `budget_allocations`, unique on (goal_id, effective_month));
  `goal_checkins` (id, goal_id, month, checked_by, checked_at, unique on
  (goal_id, month) — a row's presence means checked, so toggling is just
  insert/delete, no boolean column needed).
- **Migration data step**, in the same migration file: `insert into goals
  select ... from categories where type in ('saving','debt payoff')`,
  reusing each category's own `id` as the new goal's `id` so the amounts
  copy 1:1 (`insert into goal_amounts select id, category_id as goal_id,
  ... from budget_allocations where category_id in (...)` needs no id
  remapping). Then `delete from categories where type in ('saving','debt
  payoff')` — `budget_allocations` cascades on category delete, so no
  separate cleanup there — then `alter table categories drop constraint
  categories_type_check, drop column type`. Verified against the real
  household: no bill ever references a Saving/Debt payoff category, so the
  delete won't hit the `bill_versions_category_id_categories_id_fk`
  (no `ON DELETE`, i.e. restrictive) constraint; if it ever did on some
  other install, the migration fails cleanly inside its transaction rather
  than losing data — acceptable for a single-household self-hosted app.
- **`src/lib/goals.ts`** (new): mirrors `categories.ts` (`listGoals`,
  `createGoal`, `updateGoal` for name/position/archived/type) plus
  `budgets.ts`'s time-versioning for amounts (`getGoalsMonth`,
  `setGoalAmount`) and a small checkin helper (`setGoalCheckin(goalId,
  month, checked)`). `src/lib/goalTypes.ts` (new, replaces
  `categoryTypes.ts`): `GOAL_TYPES`, `GoalType`, `TYPE_LABELS`,
  `groupByType`, importable by client components without pulling in the
  database client, same reasoning as spec 012's `categoryTypes.ts`.
- **`src/lib/categories.ts` / `src/db/schema.ts`**: drop `type` from
  `categories`, `CategoryPatch`, `createCategory`, `STARTER_CATEGORIES`
  (drops "Savings"); delete `categoryTypes.ts` and its re-export.
- **`src/lib/budgets.ts`**: `getBudget` composes `getGoalsMonth` alongside
  categories so `totalCents`/`unallocatedCents` include goal amounts —
  still the single source everything else reads (`Budget` gains a
  `goalsTotalCents` field; `categories` stays Expense-only). `BudgetLine`
  drops `type`.
- **`src/components/BudgetEditor.tsx`**: drop the type grouping
  (`groupByType` usage) back to a flat list; take a new
  `goalsCommittedCents` prop (a fixed number for the month, not editable
  here) folded into the live Unallocated calculation alongside the
  category total being typed. `AssignUnallocated`'s rows accept either a
  `categoryId` or a `goalId`; the select lists both, grouped; the API call
  sends whichever is set.
- **`src/lib/budgets.ts` `assignUnallocated`**: assignment rows become
  `{ categoryId } | { goalId }` plus `amountCents`; writes to
  `budget_allocations` or `goal_amounts` depending on which. The advisory
  lock and all-or-nothing behavior (spec 007) are unchanged.
- **`src/components/CategoryManager.tsx`**: drop the type `<select>`.
  **`src/components/overview/CategoryTable.tsx`**: drop the type grouping,
  back to a flat table (as before spec 012). **`OverviewCategory`** drops
  `type`.
- **`src/lib/overview.ts`**: `spendingCents` becomes the full category
  total (there's only one type now); `savingCents`/`debtPayoffCents` and
  `restSavingCents`/`restDebtPayoffCents` come from `getGoalsMonth` instead
  of category sums — and since goals have no bills, `rest* === ` the full
  amount always (no bills-vs-rest distinction needed for goals, unlike
  spec 013's category-based version). `CashFlowCard.tsx` needs **no
  changes** — it only reads `cf.*` fields, agnostic to where they came from.
- **New routes**: `GET/POST /api/goals`, `PATCH /api/goals/[id]`,
  `GET /api/goals/[month]`, `PUT /api/goals/[month]/amounts/[id]`,
  `PUT /api/goals/[month]/checkins/[id]` (body `{ checked: boolean }`,
  no month-editability check). `POST /api/budgets/[month]/assign-unallocated`
  accepts goal rows alongside category rows.
- **New page** `src/app/goals/page.tsx` + `GoalEditor`/`GoalManager`
  components, following the Budget/Bills/Income page shape (`PlanHeader`-like
  header with month nav, though goals get their own small header since they
  aren't part of the existing three-tab Plan group). `HeaderNav` gains
  "Goals" as a 4th top-level destination (still ≤ 5). **Superseded by spec
  015**, which moved Goals into the Plan tab group as a 4th tab (`PlanTabs`,
  `PlanHeader`) and dropped it back out of `HeaderNav` — in practice it read
  as an orphaned destination rather than a genuinely different kind of thing
  from Budget/Bills/Income. Spec 015 also moved the Assign panel from the
  Budget page to Income.
- **Tests**: new `tests/goals.test.ts` (CRUD, time-versioned amounts,
  checkins editable in the past, starter goal); extend
  `tests/budgets.test.ts`/`tests/assign.test.ts` for the combined
  Unallocated and goal-targeted assigns; extend `tests/overview.test.ts` for
  goals-sourced cash-flow figures; update `tests/plan-ui.test.tsx`,
  `tests/overview-ui.test.tsx` for the flat (ungrouped) category rendering;
  a migration test that seeds pre-migration-shaped rows and asserts the
  post-migration `goals`/`goal_amounts` content. Browser: new
  `e2e/goals.spec.ts`; update `e2e/categories.spec.ts` (grouping tests no
  longer apply — delete or repurpose), `e2e/assign.spec.ts` (goal targets).

## Decisions
- **Full replacement, not two systems side by side.** Keeping category
  `type` around "just in case" while also having goals would mean two ways
  to track the same thing and a confusing choice every time someone adds a
  category. The fully-separate-table option was chosen specifically to
  avoid that; this spec finishes the job by removing the old path rather
  than leaving it dormant.
- **Debt payoff follows Saving's pattern, not Expenses'.** A debt payment
  is exactly as unobservable to this app as a savings transfer — both
  happen at a bank or creditor the app has no visibility into. Treating it
  as an Expense would imply the app can verify it via a transaction, which
  it can't any more than it can verify a Roth contribution.
- **The checkmark is editable for any month, unlike amounts.** An amount is
  a plan and past plans stay put so history reads accurately (the rule
  every time-versioned figure in this app already follows). A checkmark is
  a fact, often confirmed after the fact — locking it to the current month
  would mean never being able to record last month's transfer once it
  clears.
- **Goals keep contributing to Unallocated even though they're off the
  Budget page.** The alternative — Unallocated only reflecting Expenses —
  would make it look like there's more free money than there actually is
  the moment a goal is funded. Unallocated has meant "everything not yet
  earmarked, anywhere" since spec 004; that shouldn't change just because
  goals moved to their own page.
- **No bills-vs-rest split for goals.** Categories need it because a
  category's budget might be partly consumed by a recurring bill. Goals
  have no bills at all (bills still only attach to Expense categories), so
  the "rest" figure for a goal is always its full amount — simpler than
  the category case, not a shortcut.
- **Reusing category ids as goal ids in the migration** is an
  implementation convenience (the amounts copy without a lookup), not a
  guarantee anything depends on — goals are a distinct table with no FK
  back to categories.

## Documentation
- `README.md`: describe goals as their own feature (replacing the spec-012
  category-type description), the Goals page, and that Unallocated
  includes them.
- `CLAUDE.md`: the `goals`/`goal_amounts`/`goal_checkins` tables and their
  time-versioning/checkin rules, that `categories` is Expense-only again,
  where Overview's Saving/Debt payoff figures now come from, and the
  Assign-unallocated extension.
- `specs/012-category-types.md`: mark superseded by this spec, note what
  was kept (the Saving/Debt payoff *concepts* and the Overview stats/bar)
  and what was reverted (category `type`, the grouping UI).
- `specs/013-overview-saving-debt-totals.md`: note the data source changed
  from categories to goals; the UI and figures themselves are unchanged.
- `specs/007-bills-and-budget-polish.md`: note Assign now also targets
  goals.

## Verification
Before deploying to the real stack: back up the real database, apply the
migration to a copy, and confirm the 5 existing Saving categories became
goals with identical names, amounts, and history, and that `categories` no
longer has any saving/debt-payoff rows. Then on the real deploy: confirm
the Goals page shows all 5 with their current amounts, add a new Debt
payoff goal, check off a goal for the current month, edit a past month's
checkmark, and confirm Unallocated on the Budget page and the Overview
still agree with each other and account for the goals. Confirm the Budget
page's category list and the Overview's category table are flat (no
section headers) again. Use Assign to send unallocated money to a goal.
Check both themes and phone width. Run tests, lint, build, and
`npm run test:e2e`; `npm run test:e2e:docker` once before merging.

## Implementation notes
- **Route collision:** Next.js treats `/api/goals/[id]` and `/api/goals/[month]`
  (plus their children) as ambiguous at the same path level and fails the
  build. Fixed by nesting every month-scoped goal route under a static
  segment, `/api/goals/month/[month]/...`, mirroring how Income already
  disambiguates via its static `sources` segment.
- **Real bug caught by e2e, not by inspection:** `src/lib/plan.ts`'s
  `getPlanSummary` still computed `budgetedCents: b.totalCents`
  (categories-only) after `getBudget` was changed to include goals, so the
  Bills and Income pages' Plan summary bar silently excluded goal amounts
  (Unallocated would have shown $1,000 too high) while the Budget page
  (computed independently in `BudgetEditor`) was already correct. Fixed to
  `budgetedCents: b.totalCents + b.goalsTotalCents`, with a dedicated
  regression test added to `tests/plan.test.ts` since no existing test
  exercised Bills/Income's summary against a household with goals.
- Three e2e races were found (fire-and-forget PATCH/PUT with no visible
  save confirmation, asserted against immediately after `blur()`/`check()`
  rather than after the request resolved) and fixed with
  `page.waitForResponse(...)` before the next navigation or assertion, in
  `assign.spec.ts`'s rename-preselect test and `goals.spec.ts`'s rename and
  checkbox-persistence tests.
- A locator strict-mode violation in `goals.spec.ts` ("adding a Debt payoff
  goal groups it separately") matched two `<option value="debt payoff">`
  elements inside the page's `TypeSelect`s in addition to the intended
  group-header row; scoped to `li[aria-hidden="true"]` (the decorative
  group header `GoalEditor` renders) to fix it.
- A written "checkbox can be set for a past month" e2e test was deleted
  rather than fixed: `resetAndSeed()` always creates the household in the
  real current month (no clock mocking in Playwright), so a "past" month
  relative to that never has the goal visible to check. This behavior is
  already covered at the unit level in `tests/goals.test.ts` with a mocked
  clock.
- **Migration verified against a copy of the real database**, not just
  against test fixtures: `pg_dump`'d the live `monies` database, restored
  it into a scratch `monies_migration_test` database in the same Postgres
  container, and applied `drizzle/0006_goals.sql` directly. All 5 real
  Saving goals (KT Brokerage, KT Roth IRA, Ridge 529, Ridge UTMA Brokerage,
  Marcus High Yield) came through with identical ids, names, positions,
  start months, and full amount history (including KT Brokerage's
  September → October rate change); `categories` lost its `type` column
  and the 5 rows, with the other 8 Expense categories untouched. Scratch
  database dropped afterward.
- Verified: 307 Vitest tests, 84 browser tests (3 skipped, production-only
  error-page tests), lint, typecheck, a local production build, and
  `npm run test:e2e:docker` (signin against a freshly built image on a
  scratch database). Screenshots reviewed in both themes and at phone width
  on the Goals, Budget, and Overview pages.

## Not verified
Real Safari and iOS (the WebKit project is not run); Firefox (does not
launch in this environment).
