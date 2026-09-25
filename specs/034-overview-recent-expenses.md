# 034: Overview shows a recent-expenses ledger instead of a total-only card

**Status:** implemented

## Goal
Spec 023 gave Expenses a card in the Income/Bills/Expenses/Goals grid but
explicitly deferred showing individual expenses on Overview as "new data
plumbing... a separate, future spec if wanted." A total with no rows looks
out of place next to Income, Bills and Goals, which all list their real
line items. This spec is that future spec: Expenses moves out of the
4-card grid into its own full-width section at the bottom of the page,
showing the month's actual logged expenses (newest first, grouped by day)
with a running total — a ledger, not just a number.

## Requirements
- **Expenses leaves the card grid.** Income, Bills and Goals become a
  3-column grid (`sm:grid-cols-2 lg:grid-cols-3`); Expenses is no longer
  one of the four cards.
- **A new full-width "Expenses" section renders at the bottom of the
  Overview page**, below that 3-card grid — the last section on the page.
  It is a `<section>` styled like the Budget table (a card, not a grid
  tile), with an "Expenses" heading and a "Log expense" action linking to
  `/expenses`, same as today's card.
- **It lists the month's actual expenses**, newest `spentOn` first (ties
  broken by `createdAt` descending, matching `getExpensesMonth`'s existing
  order), grouped under a date heading whenever the day changes. Each row
  shows the category name, the description if present, and the amount.
- **Shows at most the 10 most recent expenses.** When the month has more
  than 10, a "View all in Expenses" link to `/expenses` appears after the
  list; the full editable log already lives on that page. Fewer than (or
  exactly) 10, no such link.
- **A total row at the bottom**, styled like `CategoryTable`'s Total row
  (`bg-surface`), showing the month's full expense total — sourced from
  `cashFlow.expensesCents` (already computed, already the single source
  for this figure), not resummed from the displayed rows, so a capped
  list never disagrees with the real total.
- **Empty state unchanged in spirit**: "No expenses logged this month
  yet." with the "Log expense" link, same wording as today's card.
- **Read-only.** No delete, no edit — same as every other Overview
  section; deleting an expense stays on `/expenses`.

## Out of scope
- Any change to `getExpensesMonth`, the expenses API routes, or the
  `/expenses` page itself — this reuses the existing query as-is.
- Pagination beyond "10 then a link out" — no infinite scroll, no
  month-spanning list.
- Editing or deleting an expense from Overview.
- Per-category color coding for expense rows (categories have no color
  identity anywhere else in the app; not introducing one here).
- Any change to `cashFlow.expensesCents`, `Budget`, or any other number
  on the page — appearance and one new data source (the row list) only.

## Acceptance criteria
- [x] The 3-card grid holds Income, Bills and Goals only; Expenses is not
      among them (covered by a render test).
- [x] A full-width Expenses section renders below the grid, with the
      month's expenses grouped by day, newest first, each row showing
      category, description (if any) and amount (covered by a render
      test using seeded expense rows).
- [x] More than 10 expenses in the month shows exactly 10 rows plus a
      "View all in Expenses" link to `/expenses`; 10 or fewer shows no
      such link (covered by render tests at both boundaries).
- [x] A Total row shows `cashFlow.expensesCents`, unchanged by the
      10-row cap (covered by a render test with >10 expenses where the
      row sum would differ from the real total if summed client-side).
- [x] Zero expenses shows "No expenses logged this month yet." and the
      "Log expense" link, no Total row (covered by a render test).
- [x] `npm test`, `npm run test:e2e` and `npm run lint` pass.
- [x] Documentation updated (see Documentation).

## Technical notes
- **`src/lib/overview.ts`**: `getOverview` adds `getExpensesMonth(ctx,
  month)` to its `Promise.all`. New `Overview.expenses` field:
  `{ recent: ExpenseLine[]; count: number }` — `recent` is the first 10
  rows of `getExpensesMonth`'s already-sorted list, `count` is
  `expenses.length` (for the "View all" decision). `ExpenseLine` is
  imported from `@/lib/expenses` (no new type). The existing
  `cashFlow.expensesCents` is untouched and stays the total's source.
- **`src/components/overview/ExpensesCard.tsx`** is replaced by
  **`ExpensesList.tsx`**: full-width section (same card classes
  `CategoryTable` uses), a heading row (Expenses + "Log expense"), the
  grouped-by-day list, the "View all" link when `count > 10`, a
  `cardCls`-consistent Total row, and the existing empty state. Props:
  `expenses: Overview["expenses"]`, `totalCents: number` (from
  `cashFlow.expensesCents`), `currency: string`, `href: string`.
- **`src/app/page.tsx`**: drop `ExpensesCard` from the grid (grid becomes
  `sm:grid-cols-2 lg:grid-cols-3` with Income/Bills/Goals), add
  `<ExpensesList expenses={o.expenses} totalCents={o.cashFlow.expensesCents}
  currency={o.currency} href={`/expenses${q}`} />` after the grid.
- **Tests**: `tests/overview-ui.test.tsx` — replace the `ExpensesCard`
  describe block with `ExpensesList` (grouping, the 10-row cap and "View
  all" link, the Total row, the empty state). `tests/overview.test.ts`
  needs a case seeding >10 expenses to assert `data.expenses.recent`
  length and `data.expenses.count`. `e2e/overview.spec.ts`: the "expenses
  card" test now targets the bottom section instead of a grid card; the
  layered-surfaces region list keeps `Expenses` (now the bottom section,
  still a `region` named "Expenses").

## Decisions
- **Cap at 10 rather than show the whole month.** Matches spec 023's own
  instinct to keep Overview scannable; a heavy-spending month shouldn't
  make Expenses the longest section on the page. The full log is one
  click away on `/expenses`, which already exists for exactly this.
- **Grouped-by-day ledger, not a receipt-styled visual metaphor.** A
  literal torn-paper/receipt treatment would be the only skeuomorphic
  element in an otherwise flat, token-based design system (spec 011) and
  would need new CSS tricks (perforation masks, dashed card edges) with
  no precedent elsewhere in the app. A day-grouped list with a dashed
  divider between days nods at a receipt tape's rule lines without
  introducing a one-off visual language.
- **Total sourced from `cashFlow.expensesCents`, not summed from the
  displayed rows.** The row list is capped at 10; summing only what's
  shown would silently under-report in any month with more than that,
  and CLAUDE.md's Overview rule is that these figures never get
  recomputed from a partial view.

## Documentation
- `README.md`: note that Overview's Expenses section is a recent-expenses
  ledger (day-grouped, capped at 10 with a link to the full log), not a
  totals-only card.
- `CLAUDE.md`: update the Overview bullet — Expenses is a full-width
  ledger section at the bottom of the page, not one of the grid cards;
  add `Overview.expenses` to the composed-data description.
- `specs/README.md`: index entry for 034.

## Verification
`npm run dev`: confirm the 3-card grid (Income, Bills, Goals) and a
full-width Expenses section below it — day-grouped rows, a Total row
matching the existing total, the empty state at zero expenses, and (log
more than 10 in a month to check) the 10-row cap with a working "View
all in Expenses" link. Check both themes and phone width. Run `npm test`,
`npm run test:e2e`, `npm run lint`, and `npm run build`.
