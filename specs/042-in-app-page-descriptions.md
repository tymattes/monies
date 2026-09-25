# 042: In-app page descriptions and a richer getting-started guide

**Status:** approved

## Goal

Right now the only explanation of what Monies is and how it's meant to be used lives in `README.md` — a new user who never reads that file sees a bare page title ("Income", "Bills", "Goals"...) and the four-step get-started checklist with no context for *why* each step matters or how much effort it expects. This spec brings a slice of that explanation into the app itself, tied to `brief.md`'s "dashboards should be genuinely useful, not decorative" and the Philosophy section of the README (Plan / Expenses / Hub, and "a plan is not a commitment"). It also makes explicit, in the UI, that expense-logging detail is the user's choice — from every purchase down to just a credit card bill and big-ticket items — since that's currently only documented in `README.md`.

## Requirements

- Every top-level page/tab (Hub, Income, Budget, Bills, Goals, Expenses, Members) shows a short, one-line description under its title, explaining what the page is for in plain language. Wording should stay consistent with the corresponding README language so the two never contradict each other.
- `PlanHeader` (shared by Income, Budget, Bills, Goals) grows a description per tab, keyed off `title` so each of the four pages doesn't repeat itself.
- The Hub, Expenses and Members pages get an equivalent one-line description inline in their own headers (they don't use `PlanHeader`).
- The Expenses page's description explicitly states that logging detail is up to the user (e.g. "Log every purchase, or just the big ones — the app works either way").
- `GetStarted` (`src/components/overview/GetStarted.tsx`) gets a short intro sentence above the four steps, making clear the checklist is a starting point, not a completeness requirement — a household can run on rough numbers.
- No change to `GetStarted`'s four existing steps or their done-conditions; this spec only adds explanatory copy, not new steps or logic.

## Out of scope

- Adding Expenses as a fifth get-started step (it's ongoing, not a one-time setup action).
- A dismissible/persistent "help" panel, tooltips, or a full onboarding tour.
- Any change to page behavior, data, or routes — copy only.

## Acceptance criteria

- [x] Hub, Income, Budget, Bills, Goals, Expenses and Members each show a one-line description under their title.
- [x] `PlanHeader` takes the description from a table keyed on `title`, not a prop repeated at each of the four call sites.
- [x] The Expenses page's description mentions that logging can be as granular or as sparse as the user wants.
- [x] `GetStarted` has an intro sentence above the step list clarifying the checklist is guidance, not a requirement.
- [x] `npm run lint` and the relevant Vitest UI tests (`tests/plan-ui.test.tsx`, `tests/overview-ui.test.tsx`, `tests/theme.test.ts`) pass with the new copy; full `npm test` (379 tests) passes.
- [ ] `npx playwright test` accessibility scans still pass (new text doesn't break contrast or heading order) — not run: a pre-existing `next dev` process already held port 3000 in this environment and Next's single-instance dev lock blocked Playwright's own server from starting. `tests/theme.test.ts` (WCAG AA contrast) passed, which covers the token/contrast risk, but the full axe scan still needs a run with that other dev server stopped.
- [x] Documentation updated (see Documentation).

## Technical notes

- `PlanHeader.tsx`: add a `const DESCRIPTIONS: Record<PlanHeader's title union, string>` (or similar) and render it as a `<p className="text-sm text-muted">` under the `<h1>`.
- Hub (`src/app/page.tsx` or wherever its header markup lives), `src/app/expenses/page.tsx`, and `src/app/members/page.tsx`: add the equivalent `<p>` inline, matching the same text style used by `PlanHeader` so the look is consistent across pages.
- `GetStarted.tsx`: add one `<p className="text-sm text-muted">` between the `<h2>` and the `<ol>`.
- Keep every description to one sentence — this is a label, not documentation; anything longer belongs in the README.

## Documentation

- `README.md`: already updated ahead of this spec — the Philosophy section's Expenses bullet and the Features section's Expenses bullet now note that logging detail is up to the user (a credit card bill and big purchases is enough for an estimate; every purchase gives a precise picture).
- `CLAUDE.md`: add a line under the Navigation/UI invariants noting that top-level pages carry a one-line description under their title, sourced from a per-page table in `PlanHeader` (for the four Plan tabs) or inline (Hub, Expenses, Members), so future pages follow the same pattern.

## Verification

- Visit each of Hub, Income, Budget, Bills, Goals, Expenses and Members in the browser (light and dark) and confirm a one-line description appears under the title and reads clearly at phone width.
- Create a fresh household (or reset one via setup) and confirm the get-started checklist's new intro sentence renders above the four steps.
- Run `npm run lint`, `npm test`, and `npm run test:e2e` (or at least the relevant Playwright specs) to confirm no regressions.
