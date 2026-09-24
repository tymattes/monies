# 028: Common currencies first in the setup currency picker

**Status:** implemented

## Goal
The usability study (`usability-study-report.md`, issue 7) described the setup
currency selector as a raw ~160-entry native `<select>` and suggested a
searchable or grouped picker. Checking the code corrects part of that finding:
`src/components/CredentialsForm.tsx` already labels every option as
`CODE · Name` via `Intl.DisplayNames`, defaults to USD, and explains the choice
cannot be changed later; the server validates the code (`isValidCurrency` in
`/api/setup`). What remains true is findability: the list is alphabetical by
ISO code, so a user who does not know a code (EUR, GBP, JPY) scrolls a long
list, and native type-ahead matches only the start of the label, which is the
code. This is low priority; the choice is made once per instance.

## Requirements
- The select gains a "Common" `<optgroup>` at the top with a short fixed list
  (proposed: USD, EUR, GBP, CAD, AUD, JPY, CHF, CNY, INR, MXN, BRL, NZD),
  followed by an "All currencies" group with the full list as today.
  Codes in the common group are not repeated in the full list, so each value
  appears once.
- Labels, the USD default, the helper text and the submitted value are
  unchanged.
- Remains a native `<select>`: no free text, so no new client-side validation
  path, and no new dependency.

## Out of scope
- A type-to-search combobox. A native control already covers keyboard and
  screen-reader use; revisit only if the grouping is not enough.
- Changing the currency after setup, or guessing a default from the locale.

## Acceptance criteria
- [x] `/setup` shows the Common group first, then All currencies, with each
      code appearing exactly once and USD selected.
- [x] Any common code missing from `Intl.supportedValuesOf("currency")` on the
      running engine is skipped rather than rendered.
- [x] The existing setup e2e and the axe scan in `e2e/a11y.spec.ts` still pass.
- [x] A render test asserts the group order and that no code is duplicated.
- [x] Documentation updated (see Documentation).

## Technical notes
- `src/components/CredentialsForm.tsx`: split `CURRENCIES` into `COMMON`
  (filtered to supported codes) and `REST` (supported minus common) and render
  two `<optgroup label>`s. Keep the existing `currencyName.of(code)` labels.
- `CredentialsForm` has no `useRouter`, so it renders with
  `renderToStaticMarkup` without mocks.

## Decisions
- **Group rather than search.** It fixes the real gap (not knowing where a
  currency sits alphabetically) with a few lines and no new widget.
- **Withdrawing is reasonable.** If the owner considers the current picker
  good enough, this spec can be closed as `withdrawn` without affecting
  specs 024 to 027.

## Documentation
- `README.md` and `CLAUDE.md`: no change.

## Verification
`npm run dev` on a fresh database: on setup, confirm the Common group is first,
pick EUR, complete setup, and confirm the Overview formats in euros. Run
`npm test`, `npm run lint`, and `npx playwright test e2e/a11y.spec.ts`.
