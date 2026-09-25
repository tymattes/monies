# 039: Hub cards — honest bars, less duplication

**Status:** implemented

## Goal
Written retroactively, after the change shipped through iteration in chat
rather than a spec. Keeping it for the log per the spec-driven workflow.

The Hub's Income, Bills, Goals and cash-flow cards (specs 021–023, 033, 036)
had accumulated bar charts that misrepresented their own numbers — per-item
bars scaled to the largest item in their own list (so a fully-funded $100
goal looked nearly empty next to a $1,000 one), a composition bar and a
ranking bar sitting back to back showing near-identical shapes, and an
over-allocated cash-flow bar that let category colors run silently past the
income line instead of flagging the overflow. Brief.md asks for dashboards
that are "genuinely useful, not decorative" — these bars were decorative in
the bad sense: technically accurate in isolation, misleading at a glance.

## Requirements
- **Income card** (`IncomeCard.tsx`): "By member" drops its per-member bars
  (each scaled to the list's own max, unlike every other composition bar on
  the card) for a dot-legend list — color dot, name, amount, percentage of
  total income — matching the same treatment given to Bills' category list.
- **Bills card** (`BillsCard.tsx`): "By category" gets one stacked
  composition bar (segments sized by share of `bills.totalCents`, cycling
  `bg-chart-1` opacity shades since category count is unbounded) instead of
  a bar per row; each row shows a matching color dot and its percentage.
  "Largest" drops its bars entirely and becomes a plain list — it's a top-5
  subset, not a composition, so a bar inviting comparison against the list's
  own max was never meaningful there.
- **Goals card** (`GoalsCard.tsx`): drops the per-goal bar (scaled to the
  largest *funded* goal, so same-size goals could look mismatched depending
  on what else was funded that month) for one aggregate "Checked off: $X of
  $Y" bar, split by type color. Each row gets a ✓ `text-accent` "Checked
  off" or muted "Not checked off yet" label instead — reusing the
  `✓`/`text-accent` "done" convention `GetStarted.tsx` already uses, not an
  emoji.
- **Hub grid** (`page.tsx`): the Income/Bills/Goals row changes from
  `items-stretch` (the CSS grid default) to `items-start`, so a shorter card
  no longer stretches to match its tallest sibling and show empty space.
- **CashFlowCard**:
  - Headline stats drop Bills and Unallocated Income (both already shown in
    the bar + legend directly below) and keep only Income (take-home) and
    the full Saving/Debt payoff goal targets, relabeled "Saving goal"/"Debt
    payoff goal" to read distinctly from the bar legend's "Saving"/"Debt
    payoff" (checked-off amount, not the target).
  - The "Unallocated Income" hatch (bar + legend swatch) recolors from
    neutral `border-strong` to `accent`, matching Income card's color
    coding for the same concept.
  - The legend grid widens from 3 to 4 columns so Bills/Saving/Expenses/
    Unallocated Income fit one row instead of the 4th wrapping alone.
  - When commitments exceed income, the bar now clips each segment's color
    at the income line and draws the overflow as one aggregate block —
    `bg-danger` when it's a real over-allocation, or the existing softened
    `bg-foreground` when income is still provisional (spec 010) — matching
    `CategoryTable`'s `SpendBar` convention instead of letting segment hues
    run past what income actually covers with only a thin marker line as a
    cue.
- **Hub page order** (`page.tsx`): `ExpensesList` moves above the
  Income/Bills/Goals grid (was below it), so the ledger reads right after
  Budget instead of after the three summary cards.

## Out of scope
- No changes to the underlying data (`getOverview`, `cashFlow`, `bills`,
  `goals` shapes) — this is presentation only.
- No pie/donut charts — considered and rejected; CLAUDE.md commits the app
  to hand-built CSS bars with a text equivalent, and pie charts read worse
  than ranked/stacked bars for comparing similar-sized values.
- `CategoryTable`'s own `SpendBar` is unchanged; `CashFlowCard` now follows
  its convention rather than the reverse.

## Acceptance criteria
- [x] Income "By member" is a dot-legend list with percentages, no bars.
- [x] Bills "By category" has one stacked bar plus a dot-legend list with
      percentages; "Largest" has no bars.
- [x] Goals has one aggregate checked-off bar; each row shows a ✓/"Not
      checked off yet" status instead of a per-goal bar.
- [x] The Hub's Income/Bills/Goals cards size to their own content
      (`items-start`), not their tallest sibling.
- [x] CashFlowCard headline stats show only Income and Saving/Debt payoff
      goals; Bills/Unallocated Income appear once, in the bar + legend.
- [x] Unallocated Income hatch is accent-colored in the bar and its legend
      swatch.
- [x] The bar's legend fits Bills/Saving/Expenses/Unallocated Income on one
      row (`sm:grid-cols-4`).
- [x] An over-allocated bar clips segment colors at the income line and
      draws the overflow in `bg-danger` (or `bg-foreground` when
      provisional), never letting a segment's own hue run past income.
- [x] Expenses ledger appears above the Income/Bills/Goals grid on the Hub.
- [x] `npm run lint`, `npm test` (full suite) and `npm run build` all pass.
- [x] Checked in both light and dark theme against the live dev household,
      including an over-allocated month.
- [x] Documentation updated (see Documentation).

## Technical notes
- All changes are in `src/components/overview/{IncomeCard,BillsCard,
  GoalsCard,CashFlowCard}.tsx` and `src/app/page.tsx`; no new components.
- `MiniBar`/`pctOf` (`MiniBar.tsx`) are still used for `CategoryTable`'s
  `SpendBar`-adjacent bars elsewhere; `hatchColor` (`MiniBar.tsx`) is now
  unused after Goals stopped needing it — left in place rather than removed
  as a separate, unrelated cleanup.
- Category/member color cycling (`CATEGORY_COLORS`, `MEMBER_COLORS`) reuses
  one hue at descending opacity rather than the `chart-1..4` palette,
  because the list length is unbounded (unlike Fixed/Variable's fixed two),
  and those chart hues are already claimed by other concepts elsewhere on
  the Hub.
- `CashFlowCard`'s overflow segment is computed by capping each segment's
  cumulative cents at `cf.incomeCents` (`barSegments`), then rendering one
  aggregate block for `cf.overAllocatedCents` — the same two-part
  (within-budget / over-budget) shape as `CategoryTable`'s `SpendBar`,
  generalized across multiple typed segments instead of one.

## Documentation
`CLAUDE.md`'s Overview/Hub architecture bullet updated to describe the new
section order (Budget, then Expenses, then the Income/Bills/Goals grid — was
Budget, grid, Expenses). No `README.md` change — no new feature, route, or
config surface.

## Verification
- `npm run lint`
- `npm test` (359 passed, including updated `tests/overview-ui.test.tsx`
  assertions for the renamed "Saving goal"/"Debt payoff goal" stats and the
  new overflow-segment markup)
- `npm run build`
- Manual check in Chrome, dark and light theme, against the live dev
  household's Hub, including its September 2026 over-allocated month.
