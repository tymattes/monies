# 013: Saving and Debt payoff totals on the Overview cash-flow card

**Status:** implemented

## Goal
Spec 012 gave every category a type and grouped the Overview's Categories
table by Spending / Saving / Debt payoff, but the Cash flow card above it —
the first thing anyone sees — still only breaks income into Bills, the rest
of the budget and Unallocated, with no hint of how much of that "rest" is
actually earmarked for saving or paying down debt. This spec surfaces those
totals right in the card: two more headline numbers, plus (after the first
cut shipped text-only) a second small bar answering "how much of my income
is spending vs. saving vs. debt payoff" at a glance — the same question the
first bar answers for bills vs. flexible spending, on the other axis. No new
"actual vs. budget" comparison (there is no transaction data yet to compare
against — that belongs to a future Trends spec, once receipt capture
exists).

## Requirements
- **Cash flow card, headline stats.** When the household has at least one
  category of that type with a nonzero budgeted total for the month, add a
  **Saving** stat and a **Debt payoff** stat (same style as the existing
  Bills / Left after bills / Unallocated figures). Either, both, or neither
  may appear, depending on what is actually budgeted; a stat at $0.00 is
  omitted rather than shown as a zero, since it carries no information for a
  household that has not set anything aside.
- **Cash flow card, "By type" bar.** A second stacked bar, drawn only when
  Saving or Debt payoff is nonzero, splitting income into Spending / Saving
  / Debt payoff / Unallocated — mirroring the first bar's shape and rules
  (a text equivalent via `role="img"`/`aria-label`, a legend that repeats
  every number, never color alone, the same over-allocated marker line) but
  along the type axis instead of the bills axis. Spending is drawn in a
  neutral fill (it is the baseline, not a callout); Saving and Debt payoff
  each get their own distinct color.
- **No change to any existing figure.** Income, Budgeted, Unallocated,
  Bills, Left after bills, and the *first* bar's segments are computed
  exactly as before (spec 008/010) — everything added here is an additional
  lens on money already counted in "budgeted," not new money and not a
  change to the original bar.
- **API.** `GET /api/overview/[month]`'s `cashFlow` object gains
  `spendingCents`, `savingCents` and `debtPayoffCents` (the sum of budgeted
  amounts across categories of each type), so a future native client gets
  the same numbers.

## Out of scope
- Any change to the Budget page or `PlanSummary` (Bills/Income pages) — the
  grouped Spending/Saving/Debt payoff subtotals already added to the Budget
  page by spec 012 cover that there.
- An actual-vs-budgeted comparison for saving or debt payoff, category
  trends, or per-member views — Trends spec territory, once transactions
  exist.
- A dedicated "contribution" or "mark as transferred/paid" flow for saving
  or debt categories. Until accounts/transactions exist, the budgeted amount
  is the plan; there is nothing else to record yet.

## Acceptance criteria
- [x] `getOverview` returns `cashFlow.spendingCents`, `cashFlow.savingCents`
      and `cashFlow.debtPayoffCents`, each the sum of budgeted amounts for
      categories of that type in the month (0 when none), and the three
      always add up to the same total as `billsWithinBudgetCents +
      restOfBudgetCents` (covered by tests).
- [x] The Cash flow card shows a Saving stat only when `savingCents > 0`, a
      Debt payoff stat only when `debtPayoffCents > 0`, and neither for a
      household with only Spending categories (covered by render tests and
      in the browser, both themes and phone width).
- [x] The "By type" bar is drawn only when `savingCents > 0` or
      `debtPayoffCents > 0`; when drawn, it has a text equivalent naming
      every nonzero segment and a legend repeating every number, and the
      first (bills) bar's own text equivalent is unchanged (covered by
      render tests and in the browser).
- [x] Every existing Overview and Budget figure, and the first bar, is
      byte-for-byte unchanged (regression: existing overview/plan tests
      pass unmodified).
- [x] `GET /api/overview/[month]` exposes the three new fields (covered by
      a test).
- [x] Documentation updated (see Documentation).

## Technical notes
- `src/lib/overview.ts`: `Overview["cashFlow"]` gains `spendingCents`,
  `savingCents` and `debtPayoffCents`; `getOverview` computes each as
  `categories.filter(c => c.type === X).reduce((t, c) => t + c.budgetedCents, 0)`
  from the already-built `categories` array — no new query.
- `src/components/overview/CashFlowCard.tsx`: two more `<Stat>` entries at
  the end of the existing `grid grid-cols-2 sm:grid-cols-4`, each guarded by
  `> 0`; CSS grid already wraps extra items onto a second row, so no layout
  restructuring needed. Plain styling (no `danger` coloring) since these are
  informational, not warnings. Below that, a second bar block (own
  `role="img"`/`aria-label`, own legend `<ul>`) reusing the first bar's
  `pct()` scale and the same `over`/`overIsError` marker logic, gated on
  `cf.savingCents > 0 || cf.debtPayoffCents > 0`. Spending uses `bg-muted`
  (a neutral fill, good contrast in both themes since it is the same token
  already used for `text-muted`); Saving uses `bg-chart-3`, Debt payoff
  `bg-chart-4` — the two chart tokens the first bar doesn't already use for
  Bills (`chart-1`) and Rest of budget (`chart-2`), so the two bars never
  share a color with two different meanings.
- Tests: extend `tests/overview.test.ts` for the three sums (present,
  absent, a household with Spending only, and the three-way sum equalling
  both the bills-split total and the budgeted total); extend
  `tests/overview-ui.test.tsx` for the stats' conditional rendering and the
  new bar's visibility, text equivalent, and non-interference with the
  first bar.
- Browser: the default seed already budgets money into "Savings" (a starter
  category), so it doubles as the "bar appears, Spending is the baseline"
  case without seed changes; a new `e2e/overview.spec.ts` block adds a debt
  payoff category via the API to cover both segments together. Mutating
  tests need their own `test.describe`/`resetAndSeed()` rather than living
  inside the shared "with a seeded household" block, which only resets once
  via `beforeAll` — a mutation there leaked into a later, unrelated
  assertion until moved (see Implementation notes).

## Decisions
- Zero-value stats and the "By type" bar are hidden rather than always
  shown at "$0.00", unlike the always-present Income/Bills/Unallocated
  figures — those are core to every month, saving and debt payoff are
  optional extras that most households will not use from day one (every
  household gets a "Savings" category by default from spec 004, so showing
  it unconditionally would mean almost every household sees a permanent
  "$0.00 Saving" until they use it).
- **Revised after shipping the text-only version:** the first cut of this
  spec deliberately left the stacked bar untouched, reasoning that
  overlaying a type-based split on the bills-based bar would need a second
  visual language on the same shape. Asked directly whether saving should
  be on the graph, the better answer was a *second* bar rather than folding
  the two axes into one: each bar stays legible on its own axis (bills vs.
  flexible; spending vs. saving vs. debt payoff), and the original bar's
  bills-vs-flexible information — genuinely useful on its own — isn't lost
  to make room for the type story.
- Spending gets a neutral fill in the new bar rather than its own vivid
  chart color: it's the baseline everyone has, not something to call
  attention to the way Saving and Debt payoff are. Reusing `--muted` (an
  existing text token with confirmed AA contrast in both themes) avoids
  introducing a new color decision for something that's meant to recede.

## Documentation
- `README.md`: mention the Saving/Debt payoff stats and the "By type" bar
  where the Overview's cash-flow card is described.
- `CLAUDE.md`: the new `cashFlow` fields, the "hide when zero" rule for both
  the stats and the bar, and the color choices for the new segments.

## Verification
Fresh `docker compose up --build`: on a household with a Saving category
budgeted and a Debt payoff category budgeted, confirm both stats and the
"By type" bar appear on the Overview with the right amounts and segments;
archive/zero one out and confirm it disappears from both the stats and the
bar while the other stays; on the seeded default household (Spending only)
confirm neither the stats nor the bar appear, and that the original bar is
unchanged. Check both themes and phone width. Run tests, lint, build, and
`npm run test:e2e`.

## Implementation notes
- The default browser-test seed already budgets money into "Savings" (a
  starter category, type `saving`), so it doubled as the "bar and Saving
  stat show, Debt payoff doesn't" case without any seed changes; a new
  `e2e/overview.spec.ts` describe block adds a `debt payoff` category via
  the API to cover both segments together.
- A mutating e2e test (creating a category and budgeting it) had to live in
  its own `test.describe` with its own `resetAndSeed()`, not inside the
  shared "with a seeded household" block — that block only resets once via
  `beforeAll`, so a mutation there leaked into a later, unrelated test
  (`unallocated` came out $150 short) until moved.
- Adding the second bar meant `cashFlow(page).getByRole("img")` and
  `.getByRole("list")` in `e2e/overview.spec.ts` started matching two
  elements once a household has any Saving/Debt payoff money (which the
  default seed always does) — a Playwright strict-mode violation. Fixed by
  scoping the existing helpers to `.first()` for the original bar/legend.
- Verified: 281 Vitest tests (8 new across both parts of this spec), 106
  browser tests (3 skipped, production-only, including 4 new e2e tests),
  `npm run test:e2e:docker`, lint, typecheck, build. Screenshots reviewed in
  both themes and at phone width — the new stat wraps cleanly onto its own
  row in the existing grid, and the new bar sits below a divider without
  crowding the card.

## Not verified
Real Safari and iOS (the WebKit project is not run); Firefox (does not
launch in this environment).
