# 038: Budget page shows Expenses, like Bills, and "Left" becomes "Remaining"

**Status:** implemented

## Goal
The Hub's Budget table (`CategoryTable.tsx`) already shows Bills and
Expenses side by side against each category's Left. The Budget page's own
editor (`BudgetEditor.tsx`, `/budget`) only shows Bills — Expenses are
invisible there, and worse, its "Left" column only subtracts
`billsCents` from the budgeted amount, not `expensesCents`. That means a
category with logged expenses shows a different, wrong "Left" number on
`/budget` than the correct one already shown on the Hub. This spec adds the
missing column and fixes the underlying calculation to match. While in both
tables, it also renames the "Left" column to "Remaining" — clearer than the
terse "Left", and consistent between the two places that show it.

## Requirements
- `BudgetEditor`'s `Line` type gains `expensesCents: number` (the data is
  already computed server-side in `BudgetLine`, `src/lib/budgets.ts` —
  `budget/page.tsx` already passes the full `BudgetLine` objects through, so
  no server-side change is needed).
- An "Expenses" column appears between "Bills" and "Remaining" in the
  desktop table header, each row, and the total row — same position and
  styling `CategoryTable.tsx` already uses on the Hub.
- Every place `BudgetEditor` computes what's left (per row and the total
  row) subtracts `expensesCents` as well as `billsCents` from the budgeted
  amount, matching the `remainingCents` invariant (`budgeted − bills −
  expenses`) that already governs the Hub's numbers.
- The phone-width collapsed summary line under each category name (currently
  "Bills X · Left Y") adds Expenses and renames Left to Remaining ("Bills X
  · Expenses Y · Remaining Z"), matching `CategoryTable`'s phone line style.
- Both `BudgetEditor`'s and `CategoryTable`'s column header read "Remaining"
  instead of "Left" (desktop header, and `CategoryTable`'s `sr-only`
  caption). "Budget remaining" was considered but doesn't fit the fixed
  `w-24` column width without wrapping.

## Out of scope
- No change to `getBudget`/`BudgetLine` in `src/lib/budgets.ts` — the data
  is already there, and the internal field name (`remainingCents`) is
  unchanged — only the two tables' visible header text changes.
- No spend bar on `/budget` — that visual is Hub-specific; this page stays a
  plain editable table.
- Pre-existing stale copy elsewhere (e.g. README's spec-007 line mentioning
  a "Left after bills" figure that no longer exists in the UI) is left
  alone — unrelated to this rename.

## Acceptance criteria
- [x] "Expenses" column visible on `/budget` desktop width, between Bills
      and Remaining, in the header, every row, and the total row.
- [x] "Remaining" (per row and total) equals `budgeted − bills − expenses`
      everywhere on `/budget`, matching the Hub's numbers for the same
      month.
- [x] Phone-width collapsed line under each category includes Expenses and
      says "Remaining", not "Left".
- [x] `CategoryTable.tsx`'s column header and `sr-only` caption also say
      "Remaining" instead of "Left".
- [x] `npx vitest run tests/budgets.test.ts tests/plan-ui.test.tsx` passes.
- [x] Checked in both light and dark theme, desktop and phone width.
- [x] Documentation updated (see Documentation).

## Technical notes
- Pure display/calc change in `src/components/BudgetEditor.tsx` and
  `src/components/overview/CategoryTable.tsx`. No API or schema change —
  `expensesCents` is already on every `BudgetLine` returned by `getBudget`,
  and `remainingCents`/`leftCents` field names are unchanged, only the
  label text rendered to the page.
- `left` (the local variable name, kept as-is) is computed client-side in
  `BudgetEditor` — not read from the server's static `remainingCents` —
  because `budgeted` is locally-edited state; the fix is to subtract
  `l.expensesCents` alongside `l.billsCents` in that existing local
  computation, both per-row and in the `leftColumn` total.

## Documentation
No `README.md` feature change, but two lines describing current column
names/wording are corrected for accuracy: the Hub bullet's "what is left"
becomes "what remains", and the Plan-area bullet's totals-row column list
gets Expenses added and Left renamed to Remaining. `CLAUDE.md`'s Expenses
invariant line gets a short note that `/budget` displays and computes
Remaining the same way the Hub does, and that both renamed "Left" to
"Remaining".

## Verification
- `npm run dev`, log an expense against a category, then open `/budget` and
  confirm Remaining matches the Hub's Remaining for that category, and the
  new Expenses column shows the logged amount. Confirmed via a temporary,
  uncommitted Playwright script against a scratch database (not part of the
  test suite) — see PR verification notes.
- `npx vitest run tests/budgets.test.ts tests/plan-ui.test.tsx`
