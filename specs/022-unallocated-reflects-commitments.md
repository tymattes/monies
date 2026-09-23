# 022: Unallocated reflects commitments, not plans

**Status:** implemented

## Goal
Today, typing a number into a brand-new category's budget immediately
reduces Unallocated — before a single bill exists for it, before a
single dollar has actually been spent. The same is true of a goal:
setting its monthly target reduces Unallocated the moment you type it,
whether or not you ever confirm the transfer happened. Both are plans
being treated as if they were facts. This spec draws the line properly:
**Unallocated only shrinks for money claimed by something real** — a
Bill you're on the hook for, an Expense you logged, or a Goal
contribution you've actually checked off — never for a category's
budgeted target or an unchecked goal amount. This rewrites the core
invariant every Plan page and Overview currently read, so it needs its
own spec rather than riding along inside 019 or 021, even though it
was discovered while drafting both.

## Requirements
- **`Budget.unallocatedCents` becomes `income − bills − expenses −
  checked-off goals`**, dropping categories' budgeted sum and
  unchecked-or-checked goal targets from the formula entirely. Bills'
  contribution is unchanged from what's already computed
  (`billsTotalCents` was always the real, uncapped household total —
  it just wasn't wired into Unallocated before). Expenses' contribution
  is this month's total from spec 019. A goal's contribution is its
  amount *only* for months where it's checked off; an unchecked goal
  contributes nothing, no matter how large its target.
- **A category's Budgeted amount becomes purely a comparison target.**
  BudgetEditor is otherwise unchanged — still type a number per
  category — but that number no longer reserves anything. The existing
  `remainingCents`/over-budget-red treatment (budgeted vs. bills +
  expenses) keeps meaning exactly what it already does; only its
  connection to Unallocated is severed.
- **A goal's target is the same kind of plan.** Assign can still raise
  it (spec 020 restricts Assign to goals only); typing or assigning a
  goal amount never moves Unallocated by itself. Only checking the
  goal off for that month does.
- **`PlanSummaryData` (and everywhere it's read) carries an explicit
  `unallocatedCents`**, no longer derived client-side from
  `incomeCents − budgetedCents` — that subtraction stops being true.
- **Editing a category's amount in BudgetEditor no longer changes the
  Unallocated shown alongside it.** Since typing a budgeted number has
  no effect on the real formula, the live summary it renders can (and
  should) just display the server-given `unallocatedCents` unchanged
  while editing, instead of recomputing it from local state.

## Out of scope
- Any change to how a category's Budgeted amount is set (BudgetEditor
  itself, spec 004) — only what that number *means* for Unallocated
  changes, not how you set it.
- Any change to Assign's mechanics, locking, or its one-month top-up
  behavior (specs 007/014-017/020) — Assign still does exactly what it
  does today (raises a goal's target); this spec only changes what
  Unallocated does in response.
- Preventing someone from Assigning more, across several goals, than
  Unallocated currently shows — see Decisions.
- A UI nudge or warning when a goal's target sits unchecked for a long
  time — the existing `goal_not_checked` attention item (spec 015)
  already covers "you haven't confirmed this," which is the relevant
  prompt here too.

## Acceptance criteria
- [x] `getBudget` returns `unallocatedCents = incomeCents −
      billsTotalCents − expensesTotalCents − checkedGoalsTotalCents`;
      `totalCents` and `goalsTotalCents` (categories' and goals'
      planned sums) are returned unchanged but no longer factor into it.
- [x] A new category with a budgeted amount and no bills or expenses
      leaves Unallocated untouched; a bill or logged expense against it
      reduces Unallocated by that bill's/expense's amount, independent
      of whether the category has any budget set at all.
- [x] Setting or raising a goal's target (by hand or via Assign) leaves
      Unallocated untouched; checking that goal off for the current
      month reduces Unallocated by its amount; unchecking it restores
      the amount.
- [x] `PlanSummary`, `BudgetEditor`, and Overview all show the same
      `unallocatedCents` for a given month, sourced from `getBudget`,
      not recomputed from `incomeCents − budgetedCents` anywhere.
- [x] Editing a category's amount in BudgetEditor changes the Budgeted
      total shown but not the Unallocated figure alongside it.
- [x] `assignUnallocated`'s existing guards (no assigning when
      Unallocated ≤ 0; an assignment total that exceeds it) are
      unchanged in code but now evaluate against the new formula — a
      household can Assign into more than one goal's target using the
      same Unallocated headroom, since Assign doesn't consume it;
      checking multiple such goals off in the same month, if their sum
      exceeds real Unallocated, correctly shows as over-allocated
      (covered by a test proving this specific sequence).
- [x] Documentation updated (see Documentation).

## Technical notes
- **`src/lib/budgets.ts` `getBudget`**: add `checkedGoalsTotalCents`
  (sum of `goalsMonth.goals` where `checked`, already returned by
  `getGoalsMonth`). Change `unallocatedCents`'s formula to `incomeCents
  - bills.totalCents - expensesTotalCents - checkedGoalsTotalCents`
  (this spec is written to land after 019, so `expensesTotalCents`
  already exists on `Budget` by the time this is implemented — if
  sequenced before 019 for some reason, drop that term and add it back
  when 019 lands). `totalCents`/`goalsTotalCents` stay as-is,
  documented as planning-only figures with no bearing on Unallocated.
- **`src/lib/plan.ts`**: `PlanSummaryData` gains `unallocatedCents:
  number`; `planSummaryFromBudget` sets it from `b.unallocatedCents`
  directly instead of leaving it to be derived.
- **`src/components/PlanSummary.tsx`**: takes `unallocatedCents` as a
  prop instead of computing `incomeCents - budgetedCents`; everything
  downstream of that local variable (the over/under label, the Assign
  button's visibility) is otherwise unchanged, just reading the prop.
- **`src/components/BudgetEditor.tsx`**: gains an `unallocatedCents`
  prop (server-given, static — editing categories never changes it) and
  passes it straight through to its `<PlanSummary>` instead of that
  component deriving it from the editor's live `total`.
  `src/app/budget/page.tsx` passes `unallocatedCents={budget.unallocatedCents}`.
- **`src/lib/overview.ts`**: `over_allocated`'s check moves from
  `budgetedCents > incomeCents` to `unallocatedCents < 0` — the
  "you've planned more than you earn" heads-up, which was never backed
  by real money moving, is superseded by the more accurate "what you're
  actually on the hook for exceeds your income." `bills_exceed_income`
  is untouched (bills' own definition didn't change). The cash-flow
  card's segments (`billsWithinBudgetCents`/`restOfBudgetCents`, spec
  008/013) are rebuilt around the same three real terms
  (Bills/Expenses/checked Goals) rather than a within-budget/rest-of-budget
  split of the budgeted total — left to spec 021 to work out in full,
  since that's already its territory; this spec only guarantees the
  underlying numbers (`billsTotalCents`, `expensesTotalCents`,
  `checkedGoalsTotalCents`, `unallocatedCents`) exist and are correct
  for 021 to build the visualization from.
- **Tests**: extend `tests/budgets.test.ts` for the new formula
  (category budgeted alone doesn't move Unallocated; a bill with no
  category budget does; a checked vs. unchecked goal); extend
  `tests/assign.test.ts` with the multi-goal-assign-then-check-off
  sequence from Acceptance criteria; extend `tests/plan-ui.test.tsx` for
  `PlanSummary`'s new prop shape; extend `tests/plan.test.ts` for
  `planSummaryFromBudget`.

## Decisions
- **Assign doesn't need to change to "consume" Unallocated.** It was
  tempting to make Assign itself reduce Unallocated (restoring the old
  guarantee that assigned money is visibly spoken for), but that would
  mean a goal's *target* is being treated as a fact again — precisely
  the thing this spec is undoing. Leaving it as-is means over-committing
  across several goals' targets is possible before checking anything
  off; the moment you check enough of them off that the total exceeds
  real income, the existing over-allocated red state — already
  understood everywhere else in this app — catches it. That's a
  correct, not a missing, behavior: nothing real happened yet, so
  nothing real needs to be flagged yet.
- **`over_allocated` moves from "planned more than you earn" to
  "committed more than you earn."** The old check was arguably never
  that useful — budgeting $3,000 into categories against $2,500 income
  was flagged even though not a cent of it had actually gone anywhere.
  The new check only fires when Bills + Expenses + checked Goals
  genuinely exceed income, which is the moment a household actually
  needs to act.
- **A category's Budgeted figure keeps its name and place**, even
  though it stops reserving anything. Renaming it (to "Target," say)
  was considered and rejected: the word describes what it's always
  meant to the person typing it — "here's what I intend to spend" — and
  changing the label without changing anything about how you interact
  with it would just be churn for its own sake.

## Documentation
- `README.md`: update the "Unallocated" concept wherever it's described
  (Plan area, Overview, Assign) — it now means income minus Bills,
  Expenses and checked-off Goal contributions, not minus everything
  budgeted.
- `CLAUDE.md`: rewrite the Unallocated invariant bullet entirely — this
  is the one CLAUDE.md calls a hard invariant, so it needs to say
  plainly that budgeted amounts and unchecked goal targets no longer
  factor in, and name the three things that do.

## Verification
`npm run dev`: create a new category, budget $500 into it, confirm
Unallocated doesn't move. Add a bill against a category with $0
budgeted and confirm Unallocated drops by the bill's monthly cost. Set
a goal's target to $300 (by hand and via Assign) and confirm Unallocated
doesn't move either way; check the goal off and confirm it drops by
$300; uncheck it and confirm it recovers. Assign $1,000 into two
different goals' targets in the same month (using the same headroom
twice) and confirm Unallocated doesn't reflect either until you check
one off, at which point confirm it updates correctly, including going
negative/over-allocated if checking both off would exceed real income.
Confirm editing a category's amount on Budget doesn't move the
Unallocated shown in the same panel. Run `npm test`, `npm run test:e2e`,
`npm run lint`, and `npm run build`.
