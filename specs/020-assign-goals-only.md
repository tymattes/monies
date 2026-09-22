# 020: Assign no longer targets a budget category directly

**Status:** draft

## Goal
Assign has always been able to put leftover income straight into a
category's budgeted amount, treating it exactly like typing a new
number into Budget. Now that Expenses exists (spec 019) as the real way
a category's spend gets recorded, that path is a shortcut around it: it
lets a category's target grow without anything actually being bought,
bypassing both Bills and Expenses — the two things that are supposed to
be the only way income reaches a category. This spec closes that gap:
Assign becomes goals-only. Income can still fund a goal directly (that
money leaves the app the same way a goal always has), but a category's
budget is set by hand on Budget, or earned by what it actually costs —
never by leftover income being routed straight into it.

## Requirements
- **`assignUnallocated` only accepts goal targets.** The `{ categoryId,
  amountCents }` assignment shape and the `{ categoryId }` shorthand
  request are removed; only `{ goalId, amountCents }` and `{ goalId }`
  remain valid.
- **The Assign panel only offers goals.** The category `<option>` group,
  the `lines` prop, and the `Line` type disappear from
  `AssignUnallocated.tsx`; the target `<select>` lists goals only. "Fill
  remaining", "Split evenly", the live summary line, and the first-row
  Saving-goal preselect (never Debt payoff) all keep working exactly as
  they do today — none of that logic is goal/category-specific.
- **A clear error, not just a 400, when the old shape is sent.** A
  `categoryId` in the request body (top-level or inside `assignments`)
  is rejected with a message pointing at what replaced it, since this is
  a deliberate behavior change existing callers (or muscle memory) might
  still attempt.
- **Nothing about past assignments changes.** A `budget_allocations` row
  that a category-targeted assign wrote before this spec stays exactly
  as it is — real history, not touched retroactively. Only new assigns
  are restricted.

## Out of scope
- Anything about how a category's budgeted amount gets set otherwise —
  manual entry on Budget is unchanged and remains the only way.
- Any change to the Assign API's locking, transaction, or its target
  when it *is* a goal (spec 007/014-017 already cover that machinery;
  this spec only narrows what a target can be).
- Backfilling or flagging historical category-targeted assigns — see
  Requirements above.
- Expenses itself (spec 019) and Overview's budget-vs-actual view
  (spec 021).

## Acceptance criteria
- [x] `POST /api/budgets/[month]/assign-unallocated` with a top-level
      `categoryId`, or any `assignments` entry containing `categoryId`,
      returns 400 with a message naming Expenses as the alternative.
- [x] `{ goalId }` and `{ assignments: [{ goalId, amountCents }, ...] }`
      continue to work exactly as before (amount math, the advisory
      lock, MAX_AMOUNT, duplicate-target rejection).
- [x] The Assign panel renders only goal options; passing `lines` is no
      longer part of `AssignUnallocated`'s props (a type-level guarantee,
      not just a runtime one).
- [x] "Fill remaining", "Split evenly", the option's amount label
      (`Name · $X`), the live summary line, and the Saving-goal preselect
      all still work goals-only (covered by updated render tests).
- [x] A `budget_allocations` row written by a category-targeted assign
      before this spec is untouched and still reads correctly on Budget.
- [x] Documentation updated (see Documentation).

## Technical notes
- **`src/lib/budgets.ts`**: `Assignment` becomes
  `{ goalId: string; amountCents: number }` only. `assignUnallocated`'s
  request union drops `{ categoryId: string }`; the per-assignment loop
  drops its category branch entirely (the `"goalId" in a` check becomes
  unconditional — there is only one shape now). `budgetAllocations` stops
  being imported here if nothing else in the file still needs it (check
  — `setAllocation` still does).
- **`src/app/api/budgets/[month]/assign-unallocated/route.ts`**: drop the
  `categoryId` branches (top-level and inside `assignments`); a `categoryId`
  anywhere in the body throws `HttpError(400, "categoryId is no longer a
  valid Assign target — log an Expense against the category instead")`.
- **`src/components/AssignUnallocated.tsx`**: remove the `Line` type,
  the `lines` prop, the "Expenses" `<optgroup>` (categories were already
  grouped under that label — spec 012's residual naming, now literally
  accurate as "go log an Expense instead"), and every place `lines`
  feeds `targetCount`/`chosen`/the option list. The remaining goal
  `<optgroup>` label ("Saving & debt payoff") can drop the `<optgroup>`
  wrapper entirely now that it's the only group, or stay for the visual
  grouping — implementer's call, it's cosmetic either way.
- **`src/app/income/page.tsx`**: stop passing `lines={budget.categories}`
  to `AssignUnallocated`.
- **Tests**: `tests/assign.test.ts`'s `"assign unallocated"` and
  `"splitting across several categories"` describe blocks target
  categories throughout — these need rewriting to goals (most of
  `"assigning to a goal (spec 014)"` already does this and can absorb
  the newly-uncovered scenarios: whole-amount, existing-amount,
  splitting across several, racing requests, malformed bodies, rejecting
  a `categoryId`). `tests/assign-ui.test.tsx` drops its category-option
  fixtures and assertions. `e2e/assign.spec.ts` needs the same
  reconciliation spec 018 already did once for 015-017 — this is a second
  pass, narrower: category options gone, `categoryId` rejected.
- **Migration**: none. No schema change; this is a request-validation and
  UI change only.

## Decisions
- **Removed outright, not redirected into an Expense form.** Routing a
  picked category in Assign straight into pre-filled Expense entry was
  considered, but it conflates two different actions — "fund a goal" and
  "log something I bought" — behind one panel, and an Expense needs a
  real `spent_on` date the leftover-income framing doesn't naturally
  supply (what date did "this month's leftover" get spent on? there
  isn't one). Removing the category option and letting Expenses live on
  its own dedicated, purpose-built page (spec 019) keeps each action
  doing one thing.
- **A named error, not a generic validation failure.** This spec removes
  something that worked before; a bare 400 with no explanation reads
  like a bug report waiting to happen. Naming Expenses in the message
  turns "why did this break" into "oh, that's why" for anyone hitting it.
- **History stays untouched.** Rewriting or flagging old
  category-targeted assigns would imply they were invalid when they
  happened; they weren't — the rule only changes what's allowed *now*,
  the same as every other spec in this app that's changed a rule without
  retroactively rewriting what came before it (e.g. spec 017 only
  changed what new assigns do, never touching prior months' rows).

## Documentation
- `README.md`: update the "Assign unallocated" bullet — Assign now
  targets Saving/Debt payoff goals only; a category's budget is set
  by hand on Budget or reflects what's actually been billed/spent
  (spec 019).
- `CLAUDE.md`: update the Assign-unallocated invariant bullet to say
  goals-only, and note that a category's budgeted amount is never
  touched by Assign — only by a manual edit.

## Verification
`npm run dev`: open the Assign panel on Income and confirm only goals
appear as targets, with "Fill remaining" and "Split evenly" both still
working across multiple goal rows. Attempt a raw `categoryId` POST (or
check the reconciled `assign.spec.ts`) and confirm a clear 400. Confirm
a category's Left/Budgeted on the Budget page is unaffected by Assign
and only changes via a manual edit or a logged Expense. Check both
themes and phone width. Run `npm test`, `npm run test:e2e`, `npm run
lint`, and `npm run build`.
