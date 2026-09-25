# 038: Budget page shows Expenses, like Bills

**Status:** approved

## Goal
The Hub's Budget table (`CategoryTable.tsx`) already shows Bills and
Expenses side by side against each category's Left. The Budget page's own
editor (`BudgetEditor.tsx`, `/budget`) only shows Bills — Expenses are
invisible there, and worse, its "Left" column only subtracts
`billsCents` from the budgeted amount, not `expensesCents`. That means a
category with logged expenses shows a different, wrong "Left" number on
`/budget` than the correct one already shown on the Hub. This spec adds the
missing column and fixes the underlying calculation to match.

## Requirements
- `BudgetEditor`'s `Line` type gains `expensesCents: number` (the data is
  already computed server-side in `BudgetLine`, `src/lib/budgets.ts` —
  `budget/page.tsx` already passes the full `BudgetLine` objects through, so
  no server-side change is needed).
- An "Expenses" column appears between "Bills" and "Left" in the desktop
  table header, each row, and the total row — same position and styling
  `CategoryTable.tsx` already uses on the Hub.
- Every place `BudgetEditor` computes "Left" (per row and the total row)
  subtracts `expensesCents` as well as `billsCents` from the budgeted
  amount, matching the `remainingCents` invariant (`budgeted − bills −
  expenses`) that already governs the Hub's numbers.
- The phone-width collapsed summary line under each category name (currently
  "Bills X · Left Y") adds Expenses, matching `CategoryTable`'s phone line
  ("Budgeted · Bills · Expenses").

## Out of scope
- No change to `getBudget`/`BudgetLine` in `src/lib/budgets.ts` — the data
  is already there.
- No change to `CategoryTable.tsx` or the Hub page — it's already correct
  and is the reference this spec matches.
- No spend bar on `/budget` — that visual is Hub-specific; this page stays a
  plain editable table.

## Acceptance criteria
- [x] "Expenses" column visible on `/budget` desktop width, between Bills
      and Left, in the header, every row, and the total row.
- [x] "Left" (per row and total) equals `budgeted − bills − expenses`
      everywhere on `/budget`, matching the Hub's numbers for the same
      month.
- [x] Phone-width collapsed line under each category includes Expenses.
- [x] `npx vitest run tests/budgets.test.ts tests/plan-ui.test.tsx` passes.
- [x] Checked in both light and dark theme, desktop and phone width.
- [x] Documentation updated (see Documentation).

## Technical notes
- Pure display/calc change in `src/components/BudgetEditor.tsx`. No API or
  schema change — `expensesCents` is already on every `BudgetLine` returned
  by `getBudget`.
- `left` is computed client-side (not read from the server's static
  `remainingCents`) because `budgeted` is locally-edited state; the fix is
  to subtract `l.expensesCents` alongside `l.billsCents` in that existing
  local computation, both per-row and in the `leftColumn` total.

## Documentation
No `README.md` change (no new feature, no new route). `CLAUDE.md`'s Bills
invariant line, which already says `remainingCents` governs a category's
budget everywhere, gets a short note that `/budget` now displays and
computes it the same way the Hub does.

## Verification
- `npm run dev`, log an expense against a category with `npm run dev`
  running, then open `/budget` and confirm Left matches the Hub's Left for
  that category, and the new Expenses column shows the logged amount.
- `npx vitest run tests/budgets.test.ts tests/plan-ui.test.tsx`
