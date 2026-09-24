# 030: Set a fixed source's amount when you add it

**Status:** implemented

## Goal

Usability testing found that adding a fixed income source is a two-step chore: fill in the "New source" form (name + kind), submit, then find the new row and edit its amount inline. Let the amount be entered in the same form that creates the source, so a fixed source can be fully set up in one step.

## Requirements

- The "New source" form (`AddSourceForm` in `IncomeView.tsx`) gains an amount input, shown only when "Fixed monthly" is selected — variable sources have no single monthly amount (spec 006); they're built from deposits added after creation, unchanged.
- The amount field is optional. Left blank, source creation behaves exactly as it does today (starts at $0.00, editable inline afterward). Filled in, the source is created with that amount effective the current month — no separate edit needed.
- Switching the kind selector to "Variable" hides (or disables and ignores) the amount field; switching back to "Fixed" restores it.
- `POST /api/income/sources` accepts an optional `amountCents`, validated with the same rules as the existing `PUT .../sources/[id]` amount endpoint (`parseAmount` from `src/lib/validate.ts`). It's rejected (or ignored — see Technical notes) when `kind` is `variable`.
- The amount, when given, is set effective the current month, using the same time-versioning rule as any other fixed-amount edit (spec 006): it never touches past months, because a source can't have existed before its own creation.

## Out of scope

- An amount/first-deposit shortcut for variable sources — those still get their amount by adding a deposit after creation, as today.
- Changing how an existing source's amount is edited inline (`FixedAmount` in `IncomeView.tsx`).

## Acceptance criteria

- [x] Adding a fixed source with an amount shows that amount immediately, with no extra edit.
- [x] Adding a fixed source with the amount left blank starts at $0.00, exactly as before.
- [x] The amount field isn't shown (or has no effect) when "Variable" is selected.
- [x] An invalid amount (unparseable, negative) is rejected with the same error the inline editor gives today.
- [x] Documentation updated (see Documentation).

## Technical notes

- `src/lib/income.ts`: `createSource` gains an optional `amountCents` parameter; when the source is fixed and `amountCents` is given and greater than zero, insert the effective-current-month row into `income_amounts` in the same call (mirrors `setFixedAmount`, minus its past-month guard, which can't apply to a source being created now).
- `src/app/api/income/sources/route.ts`: `POST` reads and validates optional `amountCents` (reuse `parseAmount`, treating omission as "no amount" rather than an error) and passes it through. If `kind` is `variable` and `amountCents` is present, reject with 400 rather than silently dropping it — better to tell the user the field doesn't apply than to lose what they typed.
- `src/components/IncomeView.tsx`: `AddSourceForm` gets an `amount` field in local state, rendered next to the kind selector when `kind === "fixed"`; included in the POST body when set.

## Documentation

- `README.md`: Income bullet (spec 006) gains a sentence noting a fixed source's starting amount can be set when it's added, not only afterward.

## Verification

- `npx vitest run tests/income.test.ts`
- Manual: add a fixed source with an amount; confirm it shows correctly with no further edit. Add one with the amount left blank; confirm it still starts at $0.00. Add a variable source; confirm no amount field applies to it.
