# 018: Resume browser testing and reconcile the e2e suite

**Status:** draft

## Goal
Browser testing was paused (owner's call) to cut token usage, but running
the suite costs the agent zero tokens — the token cost was in writing the
specs, which is long since paid. What the pause actually did was replace a
cheap deterministic suite with an expensive per-session manual loop
(deploy to Docker, click every page, check both themes and phone width),
and it let the suite drift: specs 015, 016 and 017 all landed "without e2e
coverage for now", so the existing specs now assert behavior that has
changed. This spec unpauses e2e, reconciles the four drifted files against
015-017, and adds the coverage those specs skipped. The result is that
`npm run test:e2e` is green again and is the standing verification path,
instead of an agent hand-checking pages.

## Requirements
- **Unpause.** Remove the "Paused" directive from `CLAUDE.md`; e2e is the
  standing verification path again. `npm run test:e2e` and
  `npm run e2e:screenshots` are allowed and expected.
- **Reconcile `e2e/goals.spec.ts`** with spec 015: Goals is a Plan tab
  rendered through `PlanHeader` (with `PlanTabs` and the `PlanSummary`
  bar), not its own top-level destination. The "not a Plan tab" test is
  replaced with the opposite assertion.
- **Reconcile `e2e/plan.spec.ts`** with spec 015: the header reads
  Overview / Plan / Members (Goals is a Plan tab, so `/goals` marks "Plan"
  current); the summary-bar test covers all four Plan pages and the label
  is "Unallocated Income"; Assign no longer scrolls on `/budget` (it is a
  link there) and links land on `/income#assign`.
- **Reconcile `e2e/assign.spec.ts`** with specs 015-017: the panel lives on
  `/income`, not `/budget`; option labels carry the target's current amount
  (spec 016: `Name · $X budgeted` / `Name · $X`); the one-month top-up copy
  is asserted (spec 017); and the preselect-by-type behavior is unchanged.
- **Reconcile `e2e/overview.spec.ts`** with spec 015: the unallocated
  attention item and the cash-flow card's Assign link reach `/income#assign`
  (not `/budget#assign`), the label is "Unallocated Income", and the
  layered-surfaces test includes the new Goals card.
- **Add the coverage specs 015-017 skipped**, where not already covered by
  the reconciled files: the Overview Goals card (funded-goals total, per-type
  subtotals, checked-off status), the "Unallocated Income" label on the cash
  flow card and summary bar, and Assign's one-month top-up (next month
  reverts to the earlier amount).
- **Update the seed only if 015-017 changed what it produces.** The seed
  already builds one Saving goal, income, budgets and bills through the app
  API; confirm it still matches the current pages and adjust if a spec
  changed the seeded shape.

## Out of scope
- New browser coverage for features beyond the 015-017 drift (e.g. bills
  editing, member management) — existing specs already cover those and are
  untouched unless 015-017 broke them.
- Playwright test agents / AI-generated tests; this restores the existing
  hand-written deterministic suite.
- `npm run test:e2e:docker` (the container smoke test) — it still runs the
  same sign-in spec and is unaffected by 015-017; re-enabling it is just
  removing it from the pause list.
- Item 3 from the token-savings review (targeted vs full Vitest runs during
  iteration) — that is a dev-workflow note, not e2e, and lands separately.

## Acceptance criteria
- [x] `npm run test:e2e` passes clean against a `monies_e2e` database.
- [x] `E2E_PROD=1 npm run test:e2e` passes (production build path).
- [x] `e2e/goals.spec.ts` asserts Goals is a Plan tab with a PlanSummary bar.
- [x] `e2e/plan.spec.ts` asserts the three-item header, four Plan pages,
      "Unallocated Income", and Assign links to `/income#assign`.
- [x] `e2e/assign.spec.ts` exercises the panel on `/income` with
      amount-bearing option labels and the one-month top-up copy.
- [x] `e2e/overview.spec.ts` asserts the Goals card, "Unallocated Income",
      and `/income#assign` links.
- [x] `CLAUDE.md` no longer says e2e is paused; `README.md` reflects that e2e
      is the standing verification path.
- [x] Documentation updated (see Documentation).

## Technical notes
- The four drifted files are `e2e/goals.spec.ts`, `e2e/plan.spec.ts`,
  `e2e/assign.spec.ts` and `e2e/overview.spec.ts`. The seed
  (`e2e/support/seed.ts`) already produces one Saving goal and the fixed +
  variable income mix, so the reconciled assertions are expected to match
  the existing `SEED` numbers; only update `SEED` if a page changed its
  rendered shape, not its data.
- spec 016's option labels mean `option:checked` text is now
  `"Savings · $1,000.00"` rather than `"Savings"`, and a `Fill remaining`
  button appears while unallocated money is left. spec 017's copy ends with
  the next-month-reverts clause; the "Assigning all of it" and
  "stays unallocated" substrings survive but the exact sentences changed.
- `e2e/support/page.ts` already lists `/goals` in `SIGNED_IN_PAGES`, so the
  layout/a11y/screenshot specs keep working once the page renders under
  `PlanHeader`.
- Do not add to `E2E=` semantics or the `assertScratch` guard; that
  machinery is unchanged and already covered by `tests/e2e-guard.test.ts`.

## Decisions
- **Cover 015-017's new behavior, not just restore pre-pause coverage.** The
  whole point of unpausing is to stop hand-verifying pages; leaving the
  newest behavior (Goals card, "Unallocated Income", one-month top-up)
  uncovered would preserve the manual loop those specs were relying on.
- **e2e becomes the standing verification path again.** The pause's premise
  (that e2e costs tokens) was wrong — running it costs none. Reverting to it
  is a token *saving*, not a spend.
- **`npm run test:e2e:docker` stays re-enabled** (it was only disabled by
  being listed in the pause), since the container smoke test is cheap and
  catches problems local servers miss.

## Documentation
- `CLAUDE.md`: remove the "Paused (owner's call...)" sentence from the
  Browser-tests bullet and the "New pages ship without e2e coverage...
  manual check substitutes" fallback; state e2e is the standing verification
  path.
- `README.md`: the Tests section already describes `test:e2e` and
  `e2e:screenshots`; drop any "paused" implication and note e2e is active.

## Verification
`docker compose up -d db`, then `npm run test:e2e` and
`E2E_PROD=1 npm run test:e2e`. Confirm the four reconciled specs pass and
the suite is green end to end. `npm test`, `npm run lint`, and
`npm run build` stay green.
