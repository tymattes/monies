# 035: Overview's Tasks can be completed inline

**Status:** implemented

## Goal
Every Task on Overview (spec 032) links out to another page to be resolved —
even a one-click fix like checking off a goal costs a full navigation. This
spec lets four task types expand in place into the same form the real page
already uses, so the task is completed without leaving Overview. Tasks
without one specific completable action (a review, not a submission) keep
linking out, unchanged.

## Requirements
- **Four task codes gain an inline menu**, replacing their action `<Link>`
  with a toggle `<button>` that expands a panel inside the same card:
  - `goal_not_checked` — no form: the action *is* the button. Clicking
    "Check off" performs the check-in immediately (the same
    `PUT /api/goals/month/[month]/checkins/[id]` `GoalEditor` uses),
    optimistic, with an inline "Checking off…" state — no separate confirm
    step, since a second click inside an expanded panel would be pure
    friction for a task with only one field (spec 014: check-ins aren't
    time-versioned, so this is safe for any month, though the task itself
    only ever appears for the current one).
  - `unallocated` — expands to the existing `AssignUnallocated` panel,
    embedded with the same `goals`/`unallocated` data Overview already
    composes (`Overview.goals`, `cashFlow.unallocatedCents`) — no new
    query. Only ever offered when `Overview.editable` is true, same as
    today's gating in `buildTasks`.
  - `log_expenses` — expands to a compact add-expense form (category,
    amount, date defaulted to today, optional description), posting to
    `POST /api/expenses` the same way `ExpenseLog`'s form does. The
    category list is `Overview.categories` (already `{id, name, ...}`
    per active category) — no new query.
  - `category_over_budget` — expands to a single amount field prefilled
    with that category's current budgeted amount (looked up from
    `Overview.categories` by the task's `categoryId`), saving via
    `PUT /api/budgets/[month]/allocations/[categoryId]`, the same call
    `BudgetEditor` makes. Only offered when `Overview.editable` is true
    (a past month keeps the plain link — budgeted amounts are read-only
    history there, spec 004's time-versioning rule).
- **Every other task code is unchanged**: `over_allocated`,
  `bills_exceed_income`, `update_income` and `update_bills` keep their
  plain `<Link>` to the full page — each is a review with no single value
  to submit, not a fillable form.
- **Multiple cards can be expanded at once**; expanding one does not close
  another.
- **On a successful inline action, refresh and let the card drop off
  naturally.** `router.refresh()` re-derives `Overview.tasks` from the
  server; a resolved task (a now-checked-off goal, a corrected budget)
  simply stops being produced by `buildTasks` and disappears from the list
  on the next render — no client-side removal or completion animation to
  build. **Assign is the one exception, by existing design (spec
  021/026):** assigning a goal's amount only plans it — "Check it off
  below when the money moves" is the panel's own confirmation — so the
  `unallocated` task never disappears from submitting Assign alone; it
  disappears only once the goal is also checked off, exactly as it does
  everywhere else in the app. Assign's panel still saves in place and
  shows its own confirmation without navigating away, which is the actual
  value of making it inline here.
- **Accessibility**: the toggle button carries `aria-expanded`; the warning
  severity's spoken "Warning: " prefix (spec 032) is unchanged; the panel
  is reachable by keyboard like any other form on the page.

## Out of scope
- Inline actions for `over_allocated`, `bills_exceed_income`,
  `update_income`, `update_bills` — each points at a page, not a value.
- Any change to the Plan summary's compact task chips (spec 033) — those
  keep linking out; this spec only touches Overview's own Tasks list
  (`src/components/overview/TaskList.tsx`).
- Any change to `buildTasks`, `Task`, `getOverview`'s shape, or any number
  on the page — this reuses existing data and existing save endpoints.
- A "collapse all" control or enforcing a single open card at a time.
- Auto-focusing or scrolling to an expanded panel — it opens in place,
  in the grid position the card already has.

## Acceptance criteria
- [x] Clicking "Check off" on a `goal_not_checked` task checks the goal
      off (verified against the API) and the task disappears after
      refresh, without navigation (covered by an e2e test).
- [x] Clicking "Assign" on an `unallocated` task expands the real
      `AssignUnallocated` panel in place, preselecting the same
      goal/amount it would on the Goals page; submitting shows its own
      confirmation without navigating away. Per existing Assign semantics
      (spec 021/026), the task itself persists until the goal is also
      checked off — assigning the rest to an already-funded goal and then
      checking it off does resolve it (covered by e2e tests).
- [x] Clicking "Log expense" on a `log_expenses` task expands a form;
      submitting it creates the expense (verified against the API) and
      the form clears — the task itself is permanent so it does not
      disappear (covered by an e2e test).
- [x] Clicking "Adjust budget" on an editable-month `category_over_budget`
      task expands a single amount field prefilled with the category's
      current budgeted amount; saving a high-enough amount makes the task
      disappear after refresh (covered by an e2e test, current month).
- [x] On a non-editable month, `unallocated` and `category_over_budget`
      render as plain links, no expand button, while the other two inline
      codes are unaffected by editability (covered by a render test — the
      e2e seed fixture has no retroactive over-budget data to exercise
      this against a real past month in the browser).
- [x] `over_allocated`, `bills_exceed_income`, `update_income`,
      `update_bills` still render as plain links, unchanged (covered by a
      render test).
- [x] `npm test`, `npm run test:e2e` and `npm run lint` pass.
- [x] Documentation updated (see Documentation).

## Technical notes
- **`src/components/overview/TaskList.tsx`** becomes a client component
  (`"use client"`): local `expanded: Set<string>` state keyed the same way
  list items already are (`` `${code}-${categoryId ?? goalId ?? ""}` ``).
  Takes new props beyond `items`: `month`, `currency`, `editable`,
  `categories: {id, name, budgetedCents}[]` (from `Overview.categories`),
  `goals: {id, name, type, amountCents}[]` (from `Overview.goals`). For the
  four inline codes it renders a toggle button instead of `<Link>`; for
  every other code, `<Link>` is unchanged.
- **`src/components/overview/TaskQuickExpense.tsx`** (new): the compact
  add-expense form (category select, amount, date, optional description),
  `POST /api/expenses`, `router.refresh()` on success, clears its fields
  (mirrors `ExpenseLog`'s add form but without the list below it — kept as
  its own small component rather than extracting shared logic out of
  `ExpenseLog`, since the two forms live in different layouts and the
  duplication is a few fields of state, not a maintained invariant).
- **`src/components/overview/TaskQuickBudgetAdjust.tsx`** (new): one
  amount input plus Save, `PUT /api/budgets/[month]/allocations/[id]`,
  `router.refresh()` on success — the single-row equivalent of
  `BudgetEditor`'s per-category editor.
- **Goal check-off**: inlined directly in `TaskList.tsx` (no new file) —
  it is one `PUT` call and an optimistic boolean, not worth its own
  component.
- **Assign**: `TaskList.tsx` renders the existing `AssignUnallocated`
  unchanged, `key`ed by the unallocated amount like the Goals page already
  does, so its internal row state resets correctly when the amount
  changes after a partial assign.
- **`src/app/page.tsx`**: passes the new props to `TaskList` and gives it
  a remount `key` on `[month, o.tasks.length]` (the same
  "remount when the server data changes" pattern `GoalEditor`/
  `BudgetEditor`/`ExpenseLog` already use on their own pages), so
  switching months never carries stale expand state into a different
  month's tasks.
- **Tests**: `tests/overview-ui.test.tsx` gets a new `TaskList` describe
  block (rendered with `renderToStaticMarkup`, so only the closed-state
  markup — toggle buttons present for the four codes, plain links for the
  rest — is asserted there; the interactive open/submit behavior needs a
  browser). `e2e/overview.spec.ts` gets the interactive cases per the
  acceptance criteria above, using the household API directly to seed the
  over-budget/unallocated/unchecked-goal states the existing Tasks e2e
  tests already set up.

## Documentation
- `README.md`: note in the Overview bullet that four Tasks types
  (checking off a goal, assigning unallocated income, logging an expense,
  adjusting an over-budget category) can be completed inline; the rest
  still link to their page.
- `CLAUDE.md`: update the Overview architecture bullet — `TaskList` is a
  client component with inline actions for those four codes, and note
  which props it now takes.
- `specs/README.md`: index entry for 035.

## Verification
`npm run dev`: on Overview, check off a goal inline and watch it
disappear after refresh; expand Assign, submit it, and confirm it shows
its own confirmation without navigating and the unallocated task is still
there until the goal is also checked off, at which point it disappears;
expand Log expense, submit one, confirm it does not disappear (it is
permanent) and the total elsewhere on the page updates on next load;
expand Adjust budget on an over-budget category, raise the amount, watch
it disappear. Check a past month still shows Adjust budget as a plain
link (via `tests/overview-ui.test.tsx`, not the browser — the seed
fixture has no past-month over-budget data). Check both themes and phone
width. Run `npm test`, `npm run test:e2e`, `npm run lint`, and
`npm run build`.
