# 021: Overview shows budget vs. actual

**Status:** implemented

## Goal
The categories table has said "Actual spending will appear here once
transactions arrive" since spec 008. Expenses (spec 019) is that
arrival, and spec 022 settles what "actual" means at the household
level (Bills + Expenses + checked-off Goals — the real money, not the
plan). This spec wires both into Overview: a category's row and bar
show what's actually been spent against what's budgeted, the cash-flow
bar splits income by the same real terms 022 defined instead of by
what's merely budgeted, and the over-budget attention item fires on the
real total. This is the brief's "Dashboards: budget vs. actual"
constraint, finally true rather than aspirational.

## Requirements
- **The categories table's bar and numbers reflect actual spend, not
  just bills.** The bar's fill becomes bills + expenses against the
  budgeted marker; the mobile summary line and a category's "Left" both
  already get this from `getBudget`'s updated `remainingCents` (spec
  019) — this spec is mainly about the table showing an Expenses figure
  explicitly, not folding it silently into an unlabeled number.
- **The caption stops promising a future.** Replace "Actual spending
  will appear here once transactions arrive" with an accurate
  description of what the bar now shows.
- **The over-budget attention item fires on bills + expenses**, not
  bills alone — a category can now go over budget purely from logged
  expenses, with no bill involved at all, and Needs attention should
  say so.
- **The cash-flow card's bar splits income by what's real, not by what's
  budgeted.** Spec 022 changes what Unallocated means (income minus
  Bills, Expenses and checked-off Goals); the cash-flow bar has to
  follow, since today it splits the *budgeted* total into
  bills-within-budget/rest-of-budget, a split that no longer corresponds
  to anything real once budgeted stops reserving money. It becomes
  Bills | Expenses | checked-off Goal contributions | Unallocated —
  four segments naming the same four terms 022's formula uses, so the
  bar and the number above it can never disagree.

## Out of scope
- A dedicated "recent expenses" list or feed on Overview — the Expenses
  page (spec 019) already is that list; Overview's job stays "how is the
  month going," not "here's your ledger."
- Per-member spend breakdowns — out of scope the same way per-member
  bill/expense attribution was out of scope for specs 007 and 019.

## Acceptance criteria
- [x] `OverviewCategory` carries the category's expenses figure
      alongside bills and budgeted; `leftCents` already reflects
      `budgeted − bills − expenses` for free once spec 019 lands (no
      double computation in `overview.ts`).
- [x] The categories table's bar fills with bills + expenses against the
      budgeted marker, over-budget drawn the same red-past-the-line way
      it already is for bills alone today.
- [x] The caption below the table no longer promises future data; it
      accurately describes what the bar shows now.
- [x] A category whose bills alone are within budget, but whose bills +
      expenses together exceed it, produces the over-budget attention
      item; a category with bills already over budget continues to
      (regression, not new behavior).
- [x] The cash-flow bar's segments are Bills, Expenses, checked-off
      Goal contributions and Unallocated — the same four terms and the
      same total as `getBudget`'s (post-022) `unallocatedCents` formula,
      so the bar and the summary figure above it always agree; an
      unchecked goal's target contributes nothing to the bar, matching
      022.
- [x] Documentation updated (see Documentation).

## Technical notes
- **`src/lib/overview.ts`**: `OverviewCategory` gains `expensesCents:
  number` (straight from `budget.categories[i].expensesCents`, spec
  019); `leftCents` keeps mapping from `c.remainingCents` as it already
  does — no new arithmetic, that formula already changed in `getBudget`.
  The over-budget attention check changes from `c.billsCents >
  c.budgetedCents` to `c.billsCents + c.expensesCents >
  c.budgetedCents` (equivalently, `c.leftCents < 0`, which reads more
  directly and stays correct if the formula ever changes again).
  **Rename `category_bills_over_budget` to `category_over_budget`**
  (and its message from "bills are $X over its budget" to "is $X over
  its budget") since it's no longer bills-specific — update
  `AttentionCode` and every reference.
- **`src/components/overview/CategoryTable.tsx`**: `BudgetBar` takes a
  `spent` prop (`bills + expenses`) instead of `bills`; rename the
  component/prop for clarity if it reads better (`SpendBar`/`spent` vs.
  keeping `BudgetBar`/`bills` — implementer's call). Table gains an
  `Expenses` column (`hidden ... sm:table-cell`, same responsive
  treatment as the existing Budgeted/Bills columns) between Bills and
  Left; the mobile summary line under the category name gains `·
  Expenses {money}`. The total row's Left becomes `totals.budgeted -
  totals.bills - totals.expenses`. Replace the caption paragraph.
- **`src/components/overview/CashFlowCard.tsx`** and
  **`src/lib/overview.ts`**'s `cashFlow` shape: replace
  `billsWithinBudgetCents`/`restOfBudgetCents` (a split of the budgeted
  total) with `billsCents`/`expensesCents`/`checkedGoalsCents`
  (`Overview.cashFlow`'s versions of `Budget.billsTotalCents`,
  `expensesTotalCents` and `checkedGoalsTotalCents` from spec 022) and
  keep `unallocatedCents`/`overAllocatedCents` reading straight from
  `Budget.unallocatedCents`. The bar draws four segments (Bills,
  Expenses, checked Goals, Unallocated/over-allocated) instead of the
  current two-or-more split of the budgeted total; the `aria-label` text
  equivalent names all four the same way it already names bills/rest/
  saving/debt-payoff today. The existing Saving/Debt-payoff headline
  stats (spec 013) keep showing full goal targets, not just checked
  ones — see Decisions.
- **Tests**: extend `tests/overview.test.ts` for the renamed attention
  code and the expenses-only-over-budget case; extend
  `tests/overview-ui.test.tsx` for `CategoryTable`'s new column, bar
  math, and caption text; extend `e2e/overview.spec.ts` for the same
  (a third reconciliation pass on this file, after specs 015 and 018).

## Decisions
- **The cash-flow bar follows 022's formula rather than staying a split
  of the budgeted total.** An earlier draft of this spec kept the bar
  as bills-within-budget/rest-of-budget on the theory that it answers a
  different question than "what's actually been spent." Spec 022
  removed the premise that theory depended on — once a category's
  budgeted amount doesn't reserve anything, a bar built from budgeted
  totals no longer represents money at all, only intentions. The bar
  has to track the same real terms the Unallocated figure above it
  does, or the two would visibly disagree on the same page.
- **Saving/Debt payoff's headline stats keep showing full targets, not
  just checked amounts.** This is a judgment call, not settled by 022:
  "how much am I planning to put toward goals this month" is still a
  useful number distinct from "how much have I confirmed actually
  happened." The bar's checked-Goals *segment* is where the confirmed
  amount belongs (since that's the one place the numbers must add up to
  income); the headline stat stays a planning figure, same as it's
  always been. Worth revisiting if it reads as inconsistent in practice.
- **Rename the attention code rather than add a second one.** A
  category over budget from bills, from expenses, or from both is the
  same situation from a "needs attention" standpoint — one item, one
  fix (open Budget, adjust it). Two codes for the same underlying
  condition would just be two attention items competing for the same
  row.

## Documentation
- `README.md`: update the Overview feature bullet — the categories
  table now shows actual spend (bills + expenses) against budget, not
  bills alone; drop any "coming later" framing around transactions.
- `CLAUDE.md`: update the Overview bullet's attention-code list
  (`category_bills_over_budget` → `category_over_budget`, and why);
  note `OverviewCategory` carries an expenses figure now.

## Verification
`npm run dev`: log an expense that alone pushes a category over budget
(bills within budget, expenses tip it over) and confirm the categories
table's bar, Left, and Needs attention all reflect it; confirm a
category with bills already over budget still flags correctly
(regression check). Confirm the cash-flow bar's four segments (Bills,
Expenses, checked Goals, Unallocated) sum to income and match the
numbers above it; confirm an unchecked goal's target doesn't appear in
the bar at all, and checking it off moves it from Unallocated into the
checked-Goals segment live. Check both themes and phone width. Run
`npm test`, `npm run test:e2e`, `npm run lint`, and `npm run build`.
