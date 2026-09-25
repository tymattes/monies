# 036: The Overview page is renamed "Hub"

**Status:** implemented

## Goal
"Overview" is a plain, purely descriptive label for the app's home page —
the household asked for something with more personality. This spec renames
what a person reads to "Hub," matching the word `README.md` already used to
describe the page ("the hub you return to"). Nothing else about the page
changes.

## Requirements
- The header nav's first destination reads "Hub" instead of "Overview"
  (`HeaderNav.tsx`); it still links to `/` and is still marked current the
  same way.
- The page's own `<h1>` reads "Hub" instead of "Overview" (`src/app/page.tsx`).
- No other visible copy, number, layout, or behavior on the page changes.

## Out of scope
- The route stays `/` — no redirect, no URL change. A "creative name" is a
  label people read, not an address people type.
- Internal identifiers stay "Overview," matching this project's own
  precedent (spec 015 "rename the label, not the identifier"; spec 023 did
  the same for Budget): `src/lib/overview.ts`, `getOverview`, the `Overview`/
  `OverviewCategory`/`OverviewGoal` types, `OverviewPage`, the
  `GET /api/overview/[month]` route, and the test/spec file names
  (`tests/overview.test.ts`, `tests/overview-ui.test.tsx`,
  `e2e/overview.spec.ts`) are all unchanged. `CLAUDE.md`'s architecture
  bullet is written around those code symbols, so it is unchanged too.
- Any change to the Tasks list, cash-flow card, Budget table, or any of the
  cards on the page — appearance-only, one word.

## Acceptance criteria
- [x] The header nav shows "Hub" for `/`, current-page styling unchanged
      (covered by a render test).
- [x] The page heading reads "Hub" (covered by an e2e test).
- [x] Every other e2e test that asserted the literal text "Overview" for
      this nav link or heading is updated to "Hub" and still passes.
- [x] `npm test`, `npm run test:e2e` and `npm run lint` pass.
- [x] Documentation updated (see Documentation).

## Technical notes
- `src/components/HeaderNav.tsx`: `label: "Overview"` → `label: "Hub"` for
  the `/` entry.
- `src/app/page.tsx`: the `<h1>` text `Overview` → `Hub`.
- `tests/plan-ui.test.tsx`: the nav-items assertion list and its `["/",
  "Overview"]` case become `"Hub"`.
- `e2e/overview.spec.ts`, `e2e/signin.spec.ts`, `e2e/error-page.spec.ts`,
  `e2e/layout.spec.ts`, `e2e/plan.spec.ts`: every `toHaveText("Overview")` /
  `getByRole("link"|"heading", { name: "Overview" })` for this nav
  link/heading becomes `"Hub"`. `e2e/screenshots.spec.ts`'s describe-block
  label is cosmetic and updated too, for consistency.

## Documentation
- `README.md`: the Overview feature bullet's bold name becomes **Hub**,
  and the handful of inline "Overview" mentions elsewhere in that
  paragraph and the status line follow. `CLAUDE.md` is unchanged (its
  bullet describes the code, which didn't move — see Out of scope).
- `specs/README.md`: index entry for 036.

## Verification
`npm run dev`: confirm the header nav reads "Hub" and is marked current on
`/`, and the page's own heading reads "Hub." Check both themes and phone
width. Run `npm test`, `npm run test:e2e`, `npm run lint`, and
`npm run build`.
