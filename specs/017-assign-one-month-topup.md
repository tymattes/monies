# 017: Assign is a one-month top-up, not a permanent raise

**Status:** draft

## Goal
Every amount in this app — a category's budget, a goal's target, and
Assign's own writes — uses the same time-versioned model: a row is
"effective from month X onward" until a later row supersedes it. That's
the right default for a deliberate edit (you typed a new number because
you mean it to stick), but Assign isn't a deliberate "raise this budget"
decision — it's disposing of *this month's* leftover income, and income
varies month to month. Today, assigning $200 of September's leftover into
Groceries quietly raises Groceries' budget by $200 every month forever,
and the panel's own footnote ("Applies from September onward") confirms
it, even though nothing about October's income justifies that. This spec
makes Assign a one-time top-up by default: the target's amount still goes
up this month (nothing about that changes), but a companion change reverts
it back to its pre-assign amount the following month, so the extra money
doesn't silently compound — unless the household has already made an
explicit plan for next month, which this must never overwrite.

## Requirements
- **Assigning to a category or goal writes two changes, not one.** The
  existing bump for `month` is unchanged. A new companion write for
  `month + 1` sets that target back to whatever its amount was
  immediately before this assignment.
- **Never overwrite an explicit future plan.** If a row already exists for
  that target at exactly `month + 1` — whether from a deliberate edit on
  Budget/Goals, or from an earlier Assign's own revert — the companion
  write is skipped, leaving it untouched. This also makes a second Assign
  to the same target in the same month correct automatically: the first
  Assign's revert row (holding the true pre-any-assignment amount) already
  occupies `month + 1`, so later assignments that month can't overwrite it
  with an intermediate value.
- **Months beyond `month + 1` need no extra work.** Once `month + 1`
  reverts, every later month inherits that reverted amount through the
  same "latest effective row on or before it" rule every other amount
  already uses — there is nothing further to write.
- **Only Assign gets this treatment.** Manually editing a category's or
  goal's amount on Budget/Goals keeps carrying forward exactly as it
  always has — that's still a deliberate choice, unaffected by this spec.
- **The panel's footnote is honest about the one-month scope**, replacing
  "Applies from {month} onward" with wording that says the target reverts
  next month unless changed.

## Out of scope
- Any UI to opt out of the revert (i.e., make an Assign permanent on
  purpose). Editing the target directly — this month or next — already
  achieves that; see Decisions.
- Any change to how manual budget/goal edits are stored or versioned.
- Any change to the Assign API's request/response shape, its transaction,
  or its advisory lock (spec 007/014/015/016 already cover these) — this
  only adds one more conditional write inside the same transaction.
- Playwright/e2e coverage. e2e is paused project-wide (owner's call, to
  cut token usage); this spec ships with Vitest coverage only, same as
  every spec since the pause.

## Acceptance criteria
- [x] After assigning to a category or goal in month M, that target's
      amount in month M+1 equals its amount immediately before the
      assignment (covered by API tests, both categories and goals).
- [x] If month M+1 already has an explicit amount for that target (set
      before the assign), assigning in month M does not change it
      (covered by an API test).
- [x] Two assignments to the same target within the same month both leave
      month M+1 at the amount from *before either* assignment, not the
      intermediate one (covered by an API test).
- [x] Months M+2 and beyond correctly inherit M+1's reverted amount with
      no additional writes (covered by an API test).
- [x] Manually editing a category's or goal's amount is unaffected by this
      spec — it still carries forward onward exactly as before (covered
      by existing tests continuing to pass unmodified, plus a new
      dedicated test).
- [x] The Assign panel's footnote states the one-month scope instead of
      "onward." The default "exact" state (nothing left over) is covered
      by a render test; the under-unallocated wording only arises once an
      amount is edited, which this project's static-render Vitest setup
      can't simulate (same constraint spec 016 hit) — confirmed live in
      the browser instead, both states reading correctly.
- [x] Documentation updated (see Documentation).

## Technical notes
- **`src/lib/budgets.ts` `assignUnallocated`**: each `results` entry
  already carries `amountCents` (the new bumped total); add
  `beforeCents: line.amountCents` (the value read under the lock, before
  this assignment) alongside it for both the `"goal"` and `"category"`
  branches. After the existing bump write for each result, add a second
  write: `effectiveMonth: monthStart(addMonths(month, 1))`,
  `amountCents: r.beforeCents`, using `.onConflictDoNothing({ target: [...
  .goalId/.categoryId, ....effectiveMonth] })` against the same unique
  index (`goal_amounts_goal_month_idx` / `budget_allocations_category_month_idx`)
  already used for the bump's `onConflictDoUpdate` — so an existing row at
  that month is left alone rather than overwritten. Import `addMonths`
  from `./months` (already imports `currentMonth`, `monthStart` from
  there).
- **`src/components/AssignUnallocated.tsx`**: compute
  `` const nextMonthName = monthLabel(addMonths(month, 1)); `` (both
  already importable from `@/lib/months`, no DB dependency — same as
  `MonthNav.tsx` already does). Replace the footnote's `left === 0` and
  `left > 0` branches:
  - `left === 0`: `` `Assigning all of it to ${monthName}; ${nextMonthName} goes back to the earlier amount unless you change it.` ``
  - `left > 0`: `` `Assigning ${formatMoney(total, currency)} to ${monthName}; ${formatMoney(left, currency)} stays unallocated. ${nextMonthName} goes back to the earlier amount unless you change it.` ``
  - `left < 0` (over-assigned): unchanged.
  The new top summary line from spec 016 (`Assigning $X of $Y — $Z left`)
  doesn't mention a month at all, so it needs no change.
- **Tests**: extend `tests/assign.test.ts` with the four API-level
  scenarios in Acceptance criteria (next-month revert for a category and a
  goal, an existing next-month row left untouched, two same-month
  assignments, and an M+2 check); extend `tests/assign-ui.test.tsx` for
  the new footnote wording in the default and under-unallocated render
  cases.

## Decisions
- **Revert by default, no opt-out toggle.** The whole premise of this
  spec is that "onward" is the wrong default for money whose size is tied
  to one month's income — adding a checkbox to make it permanent again
  would just reintroduce the same confusing default as an option. A
  household that actually wants the raise to stick can make that decision
  explicitly afterward, on Budget or Goals, for this month or next — the
  same one everyday action they'd already use to change any other amount.
- **Skip-if-exists, not overwrite.** The alternative — always overwriting
  month M+1 with the pre-assign amount — would silently destroy a
  deliberate future plan (someone who already set next month's Groceries
  budget higher for a known reason) and would also make a second Assign
  in the same month regress to an intermediate value instead of the true
  original. Skipping when a row already exists handles both correctly
  with one simple rule, not two.
- **No new concept, no schema change.** This is still just the existing
  time-versioned row model, with Assign now writing two rows (this
  month's bump, next month's revert) instead of one. Nothing about how
  amounts are computed, stored, or read changes.

## Documentation
- `README.md`: update the "Assign unallocated" bullet to note that an
  assignment is a one-time top-up by default — the target's budget goes
  back to its earlier amount the following month unless changed.
- `CLAUDE.md`: update the Assign-unallocated bullet (spec 015/016) to
  describe the companion revert write, the skip-if-exists rule, and that
  manual edits are unaffected.

## Verification
`npm run dev`: note a category's current amount, assign some unallocated
income into it, then navigate to next month and confirm it shows the
original amount, not the bumped one. Assign again in the still-current
month and confirm next month is still unaffected. Manually set next
month's amount for a different category first, then assign into it this
month, and confirm next month keeps the manually-set amount rather than
reverting. Repeat for a goal. Confirm the footnote reads the new wording
in both the exact and leftover cases. Run `npm test`, `npm run lint`, and
`npm run build` (e2e is paused — see Out of scope).

**Done**: 331 automated tests (including 4 new spec-017 cases covering
every scenario above except the manual DB-navigation walk), lint,
typecheck and `npm run build` all pass. The footnote's exact and
leftover wording was confirmed live in the browser. The revert-vs-skip
behavior itself was verified through the automated tests (which run
against an isolated, truncated database) rather than a fresh manual
walkthrough — the dev environment's database turned out to be shared
with a live Docker instance (also pointed at `db:5432/monies`) holding
what looks like real household data, discovered mid-verification; the
owner confirmed it's fine to leave as-is, but further manual DB
inspection was avoided past that point. A clean walkthrough against a
scratch household is still worth doing before merging.
