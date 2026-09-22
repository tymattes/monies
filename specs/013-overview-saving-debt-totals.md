# 013: Saving and Debt payoff totals on the Overview cash-flow card

**Status:** implemented

**Addendum (spec 014):** the Saving/Debt payoff figures and the bar's type
split described below are unchanged in behavior and appearance, but their
data source moved — spec 014 took Saving and Debt payoff out of
`categories` entirely into their own `goals` tables, so `cashFlow.savingCents`/
`debtPayoffCents`/`rest*` are now sums over goals, not category types. One
simplification fell out of that move: goals have no bills at all, so a
goal's `rest*` is always identical to its full amount — the "own bill"
edge case this spec originally handled for a saving-type *category* no
longer applies to a goal.

## Goal
Spec 012 gave every category a type and grouped the Overview's Categories
table by Spending / Saving / Debt payoff, but the Cash flow card above it —
the first thing anyone sees — still only breaks income into Bills, the rest
of the budget and Unallocated, with no hint of how much of that "rest" is
actually earmarked for saving or paying down debt. This spec surfaces those
totals right in the card: two more headline numbers, plus (after two rounds
of review) the bar itself splitting its "rest of budget" segment by type
once there is money to split. No new "actual vs. budget" comparison (there
is no transaction data yet to compare against — that belongs to a future
Trends spec, once receipt capture exists).

## Requirements
- **Cash flow card, headline stats.** When the household has at least one
  category of that type with a nonzero budgeted total for the month, add a
  **Saving** stat and a **Debt payoff** stat (same style as the existing
  Bills / Left after bills / Unallocated figures). Either, both, or neither
  may appear, depending on what is actually budgeted; a stat at $0.00 is
  omitted rather than shown as a zero, since it carries no information for a
  household that has not set anything aside.
- **Cash flow card, the bar itself.** The existing stacked bar's "Rest of
  budget" segment splits into **Spending / Saving / Debt payoff** once any
  of the latter two is nonzero *outside of bills* (see Decisions); until
  then the bar is pixel-for-pixel what it was before this spec. "Bills
  within budget" is not split by type — a saving category's own bill (rare,
  but possible) stays inside it, exactly as any other category's bill does.
  Same rules as always: a text equivalent via `role="img"`/`aria-label`, a
  legend that repeats every number, never color alone, the same
  over-allocated marker line.
- **No change to any existing figure.** Income, Budgeted, Unallocated,
  Bills, Left after bills, and "Bills within budget" are computed exactly as
  before (spec 008/010) — everything here is an additional lens on money
  already counted in "budgeted," not new money.
- **API.** `GET /api/overview/[month]`'s `cashFlow` object gains
  `spendingCents`/`savingCents`/`debtPayoffCents` (full budgeted totals by
  type, for the headline stats) and `restSpendingCents`/`restSavingCents`/
  `restDebtPayoffCents` (`restOfBudgetCents` split by type, for the bar), so
  a future native client gets the same numbers.

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
- Splitting "Bills within budget" by type. A saving category's own bill (an
  automatic transfer modeled as a bill, say) stays lumped into that segment
  like any other bill; see Decisions for why.

## Acceptance criteria
- [x] `getOverview` returns `cashFlow.spendingCents`/`savingCents`/
      `debtPayoffCents` (full per-type totals) and `restSpendingCents`/
      `restSavingCents`/`restDebtPayoffCents` (per-type totals excluding
      each category's own bills); the three `rest*` fields always sum to
      `restOfBudgetCents` (covered by tests).
- [x] The Cash flow card shows a Saving stat only when `savingCents > 0`, a
      Debt payoff stat only when `debtPayoffCents > 0`, and neither for a
      household with only Spending categories (covered by render tests and
      in the browser, both themes and phone width).
- [x] The bar's "Rest of budget" segment splits into Spending/Saving/Debt
      payoff only when `restSavingCents > 0 || restDebtPayoffCents > 0`;
      otherwise the bar is unchanged from before this spec, same segment,
      same label. When split, the bar's text equivalent names every nonzero
      segment and the legend repeats every number (covered by render tests
      and in the browser).
- [x] A saving or debt-payoff category's own bill is never double-counted:
      it stays inside "Bills within budget," and the bar's Saving/Debt
      payoff segments reflect only money outside of bills, while the
      headline stats still reflect the full budgeted amount (covered by a
      dedicated test and an e2e case).
- [x] Every existing Overview and Budget figure is byte-for-byte unchanged
      (regression: existing overview/plan tests pass unmodified).
- [x] `GET /api/overview/[month]` exposes the six new fields (covered by a
      test).
- [x] Documentation updated (see Documentation).

## Technical notes
- `src/lib/overview.ts`: `Overview["cashFlow"]` gains `spendingCents`/
  `savingCents`/`debtPayoffCents` (full per-type sums of `budgetedCents`,
  unchanged since the first round) and `restSpendingCents`/`restSavingCents`/
  `restDebtPayoffCents` (per-type sums of `max(budgetedCents - billsCents, 0)`
  — the same expression `restOfBudgetCents` already used, just scoped to one
  type at a time). All computed from the already-built `categories` array —
  no new query.
- `src/components/overview/CashFlowCard.tsx`: two more `<Stat>` entries at
  the end of the existing `grid grid-cols-2 sm:grid-cols-4`, each guarded by
  `> 0` (unchanged since the first round). The bar itself gains a
  `showType = cf.restSavingCents > 0 || cf.restDebtPayoffCents > 0` branch:
  when false, renders exactly the original "Bills within budget" +
  "Rest of budget" + "Unallocated" bar; when true, replaces the single
  "Rest of budget" segment with Spending (always, `chart-2` — the same color
  "Rest of budget" already used) + Saving (`chart-3`, only if `> 0`) + Debt
  payoff (`chart-4`, only if `> 0`). The legend and the `aria-label` mirror
  the same branch. "Bills within budget" and its color (`chart-1`) never
  change.
- Tests: extend `tests/overview.test.ts` for the six new fields (present,
  absent, a household with Spending only, the `rest*` fields summing to
  `restOfBudgetCents`, and a saving category whose own bill fully consumes
  its budget — `savingCents > 0` but `restSavingCents === 0`); extend
  `tests/overview-ui.test.tsx` for the stats' conditional rendering, the
  bar's conditional split, and the "own bill" case.
- Browser: the default seed already budgets money into "Savings" (a starter
  category, no bill of its own), so it doubles as the "bar splits, Spending
  is the baseline" case without seed changes; `e2e/overview.spec.ts` adds a
  debt payoff category via the API for "all three segments," and a separate
  case that gives Savings its own consuming bill to prove the bar falls back
  to its original shape while the headline stat still counts the full
  amount. Mutating tests need their own `test.describe`/`resetAndSeed()`
  rather than living inside the shared "with a seeded household" block,
  which only resets once via `beforeAll` (see Implementation notes).

## Decisions
- Zero-value stats and the bar's type split are both hidden rather than
  always shown at "$0.00" or a token sliver, unlike the always-present
  Income/Bills/Unallocated figures — those are core to every month, saving
  and debt payoff are optional extras that most households will not use
  from day one (every household gets a "Savings" category by default from
  spec 004, so showing it unconditionally would mean almost every household
  sees a permanent "$0.00 Saving" until they use it).
- **Two revisions, in order:**
  1. The first cut left the bar untouched and only added the headline
     stats, reasoning that a type-based split would need a second visual
     language layered onto the bills-based bar.
  2. Asked directly whether saving should be on the graph, that was
     revised to a **second, separate bar** (Spending/Saving/Debt
     payoff/Unallocated) below the first, so each bar stayed legible on its
     own axis.
  3. Shown a screenshot of the two bars together, the redundancy was
     obvious — both bars drew the same "Unallocated" segment at the same
     width, and the second bar was mostly repeating the first's shape with
     "Spending" standing in for "Bills + Rest." The final design folds the
     type split into the *existing* bar's "Rest of budget" segment instead:
     bills-vs-flexible stays exactly as it was (still its own segment, own
     color, own label when nothing is split), and only the flexible part
     gets subdivided by type when relevant. One bar, two questions
     answered, no repeated "Unallocated."
- A saving/debt-payoff category's own bill stays inside "Bills within
  budget," not its own segment. Splitting bills by type too would need a
  third axis on the same shape (bills × type) for a genuinely rare case —
  households don't typically model a savings transfer as a bill — so the
  simpler, honest choice is: "Bills within budget" answers "how much is
  committed to recurring bills," full stop, regardless of what those bills
  are for; the type split only applies to money that hasn't already
  answered that question. The headline Saving/Debt payoff stats still count
  the full amount, bill included, so nothing is lost — just placed in the
  bar the same way any other bill would be.

## Documentation
- `README.md`: mention the Saving/Debt payoff stats and the bar's type
  split where the Overview's cash-flow card is described.
- `CLAUDE.md`: the six new `cashFlow` fields, the "hide when nothing to
  split" rule, the bills-stay-lumped decision, and the color choices.

## Verification
Fresh dev server (`npm run dev`, or `npm run build && npm run start`): on a
household with a Saving category budgeted and a Debt payoff category
budgeted, confirm both headline stats appear and the bar's rest segment
shows Spending/Saving/Debt payoff with the right amounts; zero one out and
confirm its segment and stat disappear while the other stays; give a saving
category a bill that fully consumes its budget and confirm the headline
stat still shows the full amount while the bar falls back to a plain "Rest
of budget" segment (nothing left outside bills to split); on the seeded
default household (Spending only) confirm neither the stats nor the split
appear, and the bar is pixel-identical to before this spec. Check both
themes and phone width. Run tests, lint, build, and `npm run test:e2e`;
`npm run test:e2e:docker` once before merging.

## Implementation notes
- The default browser-test seed already budgets money into "Savings" (a
  starter category with no bill), so it doubles as the "bar splits,
  Spending is the baseline" case without any seed changes.
- A mutating e2e test (creating a category and budgeting it) had to live in
  its own `test.describe` with its own `resetAndSeed()`, not inside the
  shared "with a seeded household" block — that block only resets once via
  `beforeAll`, so a mutation there leaked into a later, unrelated test
  (`unallocated` came out $150 short) until moved.
- The two-bars version (revision 2, since replaced) briefly made
  `cashFlow(page).getByRole("img")`/`.getByRole("list")` in
  `e2e/overview.spec.ts` match two elements once a household had any
  Saving/Debt payoff money — a Playwright strict-mode violation. Moot after
  folding back into one bar, but the lesson (adding a second same-role
  element breaks unscoped locators used elsewhere) is worth remembering for
  any future second chart.
- Verified: 283 Vitest tests (6 new across the three rounds of this spec),
  107 browser tests (3 skipped, production-only), lint, typecheck, and a
  local production build (`npm run build`) — no `npm run test:e2e:docker`
  rebuild on every round this time; the Docker image is only rebuilt for a
  final check before merge, to stop filling up local Docker build cache
  (~3GB reclaimed once during this work; see the "Local-first testing"
  project memory). Screenshots reviewed in both themes and at phone width
  after each revision — the redundant second bar was itself caught this
  way, from a screenshot the user sent back.

## Not verified
Real Safari and iOS (the WebKit project is not run); Firefox (does not
launch in this environment).
