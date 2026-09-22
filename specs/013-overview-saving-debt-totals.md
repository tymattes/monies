# 013: Saving and Debt payoff totals on the Overview cash-flow card

**Status:** implemented

## Goal
Spec 012 gave every category a type and grouped the Overview's Categories
table by Spending / Saving / Debt payoff, but the Cash flow card above it —
the first thing anyone sees — still only breaks income into Bills, the rest
of the budget and Unallocated, with no hint of how much of that "rest" is
actually earmarked for saving or paying down debt. This spec surfaces those
two totals right in the card, deliberately small: two more numbers, computed
from data the app already has, no new chart and no new "actual vs. budget"
comparison (there is no transaction data yet to compare against — that
belongs to a future Trends spec, once receipt capture exists).

## Requirements
- **Cash flow card.** When the household has at least one category of that
  type with a nonzero budgeted total for the month, add a **Saving** stat
  and a **Debt payoff** stat (same style as the existing Bills / Left after
  bills / Unallocated figures). Either, both, or neither may appear,
  depending on what is actually budgeted; a stat at $0.00 is omitted rather
  than shown as a zero, since it carries no information for a household that
  has not set anything aside.
- **No change to any existing figure.** Income, Budgeted, Unallocated,
  Bills, Left after bills, and the stacked bar's segments are computed
  exactly as before (spec 008/010) — the new stats are an additional lens on
  money already counted in "budgeted," not new money and not a new split of
  the bar.
- **API.** `GET /api/overview/[month]`'s `cashFlow` object gains
  `savingCents` and `debtPayoffCents` (the sum of budgeted amounts across
  categories of that type), so a future native client gets the same numbers.

## Out of scope
- Any change to the stacked bar itself, the Budget page, or `PlanSummary`
  (Bills/Income pages) — the grouped Spending/Saving/Debt payoff subtotals
  already added to the Budget page by spec 012 cover that.
- An actual-vs-budgeted comparison for saving or debt payoff, category
  trends, or per-member views — Trends spec territory, once transactions
  exist.
- A dedicated "contribution" or "mark as transferred/paid" flow for saving
  or debt categories. Until accounts/transactions exist, the budgeted amount
  is the plan; there is nothing else to record yet.

## Acceptance criteria
- [x] `getOverview` returns `cashFlow.savingCents` and
      `cashFlow.debtPayoffCents`, each the sum of budgeted amounts for
      categories of that type in the month (0 when none) (covered by tests).
- [x] The Cash flow card shows a Saving stat only when `savingCents > 0`, a
      Debt payoff stat only when `debtPayoffCents > 0`, and neither for a
      household with only Spending categories (covered by render tests and
      in the browser, both themes and phone width).
- [x] Every existing Overview and Budget figure is byte-for-byte unchanged
      (regression: existing overview/plan tests pass unmodified).
- [x] `GET /api/overview/[month]` exposes the two new fields (covered by a
      test).
- [x] Documentation updated (see Documentation).

## Technical notes
- `src/lib/overview.ts`: `Overview["cashFlow"]` gains `savingCents` and
  `debtPayoffCents`; `getOverview` computes them from the already-built
  `categories` array (`categories.filter(c => c.type === "saving").reduce(...)`,
  same for `"debt payoff"`) — no new query.
- `src/components/overview/CashFlowCard.tsx`: two more `<Stat>` entries at
  the end of the existing `grid grid-cols-2 sm:grid-cols-4`, each guarded by
  `> 0`; CSS grid already wraps extra items onto a second row, so no layout
  restructuring needed. Plain styling (no `danger` coloring) since these are
  informational, not warnings.
- Tests: extend `tests/overview.test.ts` for the two sums (present, absent,
  and a household with Spending only); extend `tests/overview-ui.test.tsx`
  for the card's conditional rendering (neither / one / both).
- Browser: extend the existing Overview screenshot/e2e coverage with a
  seeded Saving and Debt payoff amount so both stats are checked in the
  browser, in both themes and at phone width.

## Decisions
- Zero-value stats are hidden rather than always shown as "$0.00", unlike
  the always-present Income/Bills/Unallocated figures — those are core to
  every month, saving and debt payoff are optional extras that most
  households will not use from day one (every household gets a "Savings"
  category by default from spec 004, so showing it unconditionally would
  mean almost every household sees a permanent "$0.00 Saving" until they use
  it).
- No change to the stacked bar. The bar already encodes bills vs. rest of
  budget vs. unallocated; overlaying a second, type-based split on the same
  bar would need a second visual language and risks being misread as a
  different total. Two plain numbers are clearer for now.

## Documentation
- `README.md`: mention the Saving/Debt payoff stats where the Overview's
  cash-flow card is described.
- `CLAUDE.md`: the new `cashFlow` fields and the "hide when zero" rule.

## Verification
Fresh `docker compose up --build`: on a household with a Saving category
budgeted and a Debt payoff category budgeted, confirm both stats appear on
the Overview with the right amounts; archive/zero one out and confirm it
disappears while the other stays; on the seeded default household (Spending
only) confirm neither appears. Check both themes and phone width. Run
tests, lint, build, and `npm run test:e2e`.

## Implementation notes
- The default browser-test seed already budgets money into "Savings" (a
  starter category, type `saving`), so it doubled as the "Saving shows,
  Debt payoff doesn't" case without any seed changes; a new
  `e2e/overview.spec.ts` describe block adds a `debt payoff` category via
  the API to cover "both show together."
- A mutating e2e test (creating a category and budgeting it) had to live in
  its own `test.describe` with its own `resetAndSeed()`, not inside the
  shared "with a seeded household" block — that block only resets once via
  `beforeAll`, so a mutation there leaked into a later, unrelated test
  (`unallocated` came out $150 short) until moved.
- Verified: 277 Vitest tests (4 new), 105 browser tests (3 skipped,
  production-only, including 2 new e2e tests), `npm run test:e2e:docker`,
  lint, typecheck, build. Screenshots reviewed in both themes and at phone
  width — the new stat wraps cleanly onto its own row in the existing grid,
  no layout changes needed.

## Not verified
Real Safari and iOS (the WebKit project is not run); Firefox (does not
launch in this environment).
