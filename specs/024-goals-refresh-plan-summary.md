# 024: Goals page refreshes the Plan summary after check-off and amount edits

**Status:** draft

## Goal
The usability study (`usability-study-report.md`, bug 1) found that on `/goals`,
checking off a goal or editing a goal's amount saves correctly but leaves the
Plan summary's "Unallocated Income" figure stale until the user navigates away
(in the study it stayed at $4,064.10 after both goals were checked, instead of
$1,264.10).
Spec 022 makes a checked-off goal a real claim on income, so a check-off is
exactly the action that should move that number, and the summary is the
one place the user is looking when they do it. Every sibling editor already
refreshes; `GoalEditor` is the outlier. This keeps the invariant that
Unallocated is sourced from `getBudget` and never recomputed client-side.

## Requirements
- After a successful check-off toggle in `GoalEditor`, the server-rendered Plan
  summary on `/goals` reflects the new Unallocated Income without navigation.
- After a successful goal amount save in `GoalEditor`, the same refresh happens.
- A failed save or toggle does not refresh (the existing revert/error paths are
  unchanged).
- No client-side recomputation of Unallocated (CLAUDE.md invariant).

## Out of scope
- Any change to how Unallocated is calculated (specs 022).
- Making `GoalEditor` feed client totals into `PlanSummary` the way
  `BudgetEditor` does; `router.refresh()` is the pattern used everywhere else.
- Optimistic updating of the summary before the API responds.

## Acceptance criteria
- [x] Checking off a goal on `/goals` updates the Plan summary's Unallocated
      Income without a page navigation, and unchecking restores it.
- [x] Saving an edited goal amount refreshes the Plan summary (it changes when
      the goal is checked off that month, and is unchanged when it is not).
- [x] A failed toggle still reverts the checkbox and does not refresh
      (unchanged existing code path; not separately covered by a new test).
- [x] `e2e/goals.spec.ts` "checking a goal off persists…" (or a new case) asserts
      the `Plan summary` region's Unallocated Income changes after the check-off
      without a `page.goto`, and returns after unchecking.
- [x] Existing Vitest suites still pass (no new unit test: see Technical notes).
- [x] Documentation updated (see Documentation).

## Technical notes
- `src/components/GoalEditor.tsx`: import `useRouter` from `next/navigation`
  and call `router.refresh()` after the successful API call in `commit()`
  (after `note(id, "Saved")`) and in `toggle()` (only when `ok`).
  Refresh alone is correct here: the data changes but the session does not
  (CLAUDE.md "Session changes" rule).
- Adding `useRouter` means any render test of `GoalEditor` must mock
  `next/navigation` (`vi.mock("next/navigation", () => ({ useRouter: () => ({
  refresh: () => {} }) }))`, as `tests/assign-ui.test.tsx` does); otherwise it
  throws "invariant expected app router to be mounted".
- Vitest has no DOM environment here (`renderToStaticMarkup` only, no jsdom), so
  the click → refresh path is covered in Playwright, which is active again since
  spec 018. `e2e/goals.spec.ts` already has a check-off test and
  `e2e/assign.spec.ts` shows how to read the `Plan summary` region.
- The amount path only changes Unallocated when the goal is checked off that
  month; refreshing on every successful save is still correct and cheap.

## Documentation
- `README.md`: no change (no user-facing feature).
- `CLAUDE.md`: no change; optionally extend the Goals bullet with "editors call
  `router.refresh()` so the server-rendered Plan summary stays current".

## Verification
`npm run dev`: on `/goals` with unallocated income and a goal, check it off and
confirm the Plan summary's Unallocated Income drops immediately; uncheck and
confirm it returns; edit a checked goal's amount and confirm the summary moves.
Run `npm test`, `npm run lint`, and `npx playwright test e2e/goals.spec.ts`.
