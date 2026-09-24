# 026: Assign confirms what happened and that money is claimed at check-off

**Status:** implemented

## Goal
Assigning money to a goal raises that goal's target for the month, but
Unallocated Income does not drop until the goal is checked off. That is correct
under the plan-versus-fact model (spec 022: an unchecked goal is a plan and
reserves nothing), but the Assign panel only explains the one-month revert
(spec 017). The usability study (`usability-study-report.md`, issue 4) hit this:
assigning $1,000 left Unallocated unchanged and looked like a failure.

Reviewing the code shows the consequence is worse than confusing copy. After a
successful Assign, `AssignUnallocated.assign()` only calls `router.refresh()`:
there is no success message, the rows keep their typed amounts, and because
Unallocated has not changed the panel still reads "Assign the unallocated $X"
with the Assign button enabled (asserted today in `e2e/assign.spec.ts`, "can
assign part of it…"). A second click adds the same amount to the goal again,
and the server permits it because `assignUnallocated` checks against the
unchanged `budget.unallocatedCents`. The panel needs to confirm what happened,
say what the next step is, and not invite an accidental repeat.

## Requirements
- **Explain the claim point.** The panel states, alongside the existing
  one-month top-up sentence, that assigned money is claimed when the goal is
  checked off for the month. Proposed: `It counts against Unallocated Income
  once you check the goal off on Goals.`
- **Confirm a successful assign.** After a successful POST the panel shows a
  confirmation naming what was added and to what, e.g. `Added $1,000.00 to
  Savings for September. Check it off on Goals when the money moves.`, with
  "Goals" linking to `/goals` for the assigned month (month query preserved).
- **Reset after success.** The rows return to their initial state with empty
  amounts, so the Assign button is disabled (`valid` is false) until the user
  deliberately enters a new split. This prevents an accidental repeat click
  from topping up the same goal twice.
- **One live region.** The confirmation is announced through the existing
  bottom footnote (`aria-live="polite"`) rather than a new live region
  (spec 016's rule); it is cleared as soon as the user edits a row.
- No change to the API, the advisory-lock transaction, targets, or how
  Unallocated is computed.

## Out of scope
- A combined "assign and check off" action (see Decisions).
- A server-side guard against assigning more than once per month. Repeat
  assigns are a legitimate way to add more to a goal; the fix is making the
  outcome visible, not forbidding it.
- Renaming the action to "Move to goals" (would touch the summary bar, the
  attention action label and tests; revisit if this spec does not resolve the
  confusion).
- Any change to `assignUnallocated` in `src/lib/budgets.ts`.

## Acceptance criteria
- [ ] The panel shows the claim-at-check-off sentence in both themes and at
      phone width. (Plain text using existing theme tokens/link style; not
      separately verified in a browser — `npm run dev` per Verification below
      still worth a manual look.)
- [x] After a successful assign, the footnote shows the confirmation with a
      working link to `/goals` for that month, and the Assign button is
      disabled until a new amount is entered.
- [x] Editing any row clears the confirmation and restores the normal
      footnote.
- [x] No second `aria-live` region is added.
- [x] `e2e/assign.spec.ts` "can assign part of it…" is extended to assert the
      confirmation, the link, the reset rows and the disabled button; the
      existing assertions that Unallocated is unchanged stay.
- [x] A render test in `tests/assign-ui.test.tsx` asserts the new explanatory
      sentence in the default state.
- [x] Documentation updated (see Documentation).

## Technical notes
- `src/components/AssignUnallocated.tsx` only. Add a `done` state holding the
  last successful split (goal names and amounts, resolved from `goals` before
  resetting rows). In `assign()`, on `ok`: set `done`, reset `rows` to the
  initial single row with an empty amount, then `router.refresh()`. `update`,
  `addRow`, `splitEvenly` and `fillRemaining` clear `done`.
- The footnote picks its text in order: over-limit, then `done`, then the
  existing equal/partial wording plus the new claim sentence. The component
  already computes `monthName` and `nextMonthName`.
- Resetting rows to empty rather than to the default full amount matters: the
  initial state prefills the full unallocated amount, which would recreate the
  repeat-click risk.
- Static render tests cannot click (no jsdom), so the post-assign behavior is
  verified in Playwright.

## Decisions
- **Explain and confirm, not a combined action.** A one-click "assign and check
  off" would claim money the user has not confirmed has moved, which is exactly
  what spec 022 separated. If users still miss the check-off after this, revisit
  with evidence.
- **Reset to empty, not to the full amount.** See Technical notes.

## Documentation
- `README.md`: in the Assign bullet, add that the money counts against
  Unallocated Income once the goal is checked off.
- `CLAUDE.md`: in the Assign-unallocated bullet, note the panel confirms a
  successful assign, resets its rows, and links to Goals (spec 026).

## Verification
`npm run dev` with unallocated income and an unchecked goal: open Assign, read
the note, assign part of it, confirm the confirmation and link appear and
Assign is disabled, follow the link to Goals, check the goal off, and confirm
Unallocated drops. Check both themes and phone width. Run `npm test`,
`npm run lint`, and `npx playwright test e2e/assign.spec.ts`.
