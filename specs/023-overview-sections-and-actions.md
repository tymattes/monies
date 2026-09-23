# 023: Overview sections — Budget, Expenses, and per-domain actions

**Status:** implemented

## Goal
The Overview page grew one card at a time (spec 008, 013, 015, 021) and
now reads as a Categories table followed by three near-identical cards
whose buttons all say "Manage." That hides the one thing each section is
actually for: Budget is where you edit a category's amount, Expenses is
where you log what you spent, Bills is where you add a recurring bill,
Goals is where you check a goal off, Income is where you add money. This
spec renames the Categories section to **Budget**, gives Expenses a
section of its own (it is the only real money term on the page without
one), and relabels each section's action to the verb that belongs to it.
Appearance only — no numbers, formulas, routes, or data change.

## Requirements
- **"Categories" becomes "Budget."** The section heading reads "Budget"
  (the table's column "Category" stays — that is the row's label, not the
  section's). The section's `aria-labelledby` id follows the rename; the
  `sr-only` caption already reads "Budget by category: ..." and does not
  change.
- **Expenses gets its own section**, a card alongside Income, Bills and
  Goals, showing the month's logged-spend total and linking to the
  Expenses page to log more. It reuses the total already computed in
  `Overview.cashFlow.expensesCents` — no new query, no new field.
- **Each section's action names its interaction instead of "Manage":**
  - Budget → "Edit budget" (new link in the section heading; the table
    itself stays read-only, same as today)
  - Income → "Add income"
  - Bills → "Add bill"
  - Expenses → "Log expense"
  - Goals → "Check off" (mirrors the existing `goal_not_checked`
    attention action, spec 015)
- **The Income/Bills/Goals card grid becomes four columns** to hold
  Expenses: two across on small/tablet widths, four across on desktop.
  Card contents (income by member, bills by category and largest, goals
  by funded status) are unchanged.

## Out of scope
- Any change to numbers, formulas, API routes, or the `getOverview`
  composition. Expenses' total already exists in `cashFlow.expensesCents`;
  this spec only displays it.
- Surfacing a list of individual expenses (or any other per-line data)
  on Overview — that is new data plumbing, not appearance. If a fuller
  Expenses section is wanted later, it is its own spec.
- Converting the cards into full-width stacked sections like the Budget
  table, or reordering them into Budget/Bills/Expenses/Goals-as-tables.
  This spec keeps the card grid; the "sections" are the existing cards
  plus the renamed Budget table and the new Expenses card.
- Renaming internal identifiers (`CategoryTable.tsx`, `OverviewCategory`,
  `categories` fields) — this is a visible-label change only, so
  internals stay as they are.
- Changing where each link points; every action already links to the
  right page (`/budget`, `/income`, `/bills`, `/expenses`, `/goals`).
- The GetStarted empty state (its three steps already use
  income/budget/bills wording) and the CashFlowCard's "Assign" action
  (already specific).

## Acceptance criteria
- [x] The Budget section heading reads "Budget" and its heading links to
      `/budget` via an "Edit budget" action (covered by a render test).
- [x] An Expenses card renders beside Income, Bills and Goals, showing
      the month's expense total from `cashFlow.expensesCents`, an empty
      state ("No expenses logged this month yet.") at zero, and a "Log
      expense" link to `/expenses` (covered by render tests).
- [x] Each card's action label is the domain verb, not "Manage":
      Income "Add income", Bills "Add bill", Expenses "Log expense",
      Goals "Check off" (covered by render tests asserting the link text
      and href).
- [x] The grid holds four cards and degrades to two across below the
      desktop breakpoint (covered by the existing phone-layout/e2e pass,
      not a new unit assertion).
- [x] No change to `getOverview`'s output shape, the attention items, or
      any number on the page (existing `tests/overview.test.ts` still
      green unchanged).
- [x] Documentation updated (see Documentation).

## Technical notes
- **`src/components/overview/CategoryTable.tsx`**: the `<h2>` text and
  its `id` change (`categories-heading` → `budget-heading`; the `<caption>`
  is unchanged, it already reads "Budget by category: ..."); the component
  gains a small "Edit budget" link in the heading row (same
  `secondaryButtonCls` pattern the cards use), taking an `editHref` prop
  like the cards' `href`. The `aria-labelledby` on the `<section>` follows
  the new id. File name and component/export name stay (display-only).
- **`src/components/overview/ExpensesCard.tsx`** (new): mirrors
  `IncomeCard`'s shape — heading "Expenses", an action link (no separate
  `sr-only` span, the visible text is already the full verb), and either
  the total or an empty state. Props: `totalCents`, `currency`, `href`.
  No `getExpensesMonth` call; the total is passed in from the page.
- **`src/components/overview/IncomeCard.tsx` / `BillsCard.tsx` /
  `GoalsCard.tsx`**: replace the visible "Manage" + `sr-only` span with
  a single, self-contained action label ("Add income" / "Add bill" /
  "Check off"). `secondaryButtonCls` and href props are unchanged.
- **`src/app/page.tsx`**: pass `editHref={`/budget${q}`}` to the Budget
  table; render `<ExpensesCard totalCents={o.cashFlow.expensesCents}
  currency={o.currency} href={`/expenses${q}`} />`; change the grid from
  `md:grid-cols-3` to `sm:grid-cols-2 lg:grid-cols-4` (Income, Bills,
  Expenses, Goals order). `q` is the existing month query.
- **Tests**: extend `tests/overview-ui.test.tsx` — the `CategoryTable`
  block asserts "Budget" and the "Edit budget" link; new `ExpensesCard`
  block (total, empty state, link); update the `GoalsCard` "links Manage"
  test (and any Income/Bills link-text assertions) to the new action
  labels. `tests/overview.test.ts` needs no change (the composed numbers
  are untouched). `e2e/overview.spec.ts`: update selectors/text that
  assert "Categories", "Manage", or the three-column grid to the new
  heading, labels, and fourth card.

## Decisions
- **Expenses shows the total, not a list.** The user asked for
  "appearance/display only" and a small scope; surfacing expense rows
  through `getOverview` is new data plumbing. The total already exists
  (`cashFlow.expensesCents`) and is the honest summary of the section's
  own domain. A per-line Expenses section is a separate, future spec if
  wanted.
- **Keep the card grid; add a fourth card rather than stacking
  full-width sections.** Converting each domain into a Budget-style
  table would be a large visual change for no new information and goes
  beyond "appearance only." The cards already are sections (heading +
  content + action); the gap was naming and the missing Expenses card.
- **Goals' action is "Check off," not "Manage goals."** The check-off
  is the interaction Overview already prompts for (`goal_not_checked`,
  spec 015) and the one thing you can't do from anywhere else. Editing
  a target stays available via the Goals page, which the link opens.
  (If "Manage goals" reads better in practice, it is a one-word change —
  the href is identical either way.)
- **Internal names don't change.** Renaming `CategoryTable.tsx`,
  `OverviewCategory`, or the `categories` field for a visible-label
  change would be churn that touches routes and tests for no user
  benefit. Only the words a person reads change, matching spec 015's
  "rename the label, not the identifier" decision.

## Documentation
- `README.md`: update the Overview feature bullet — the section is
  "Budget" (not "Categories"), Expenses has its own card, and each
  section links out with a domain-specific action.
- `CLAUDE.md`: update the Overview bullet — note the sections (Budget,
  Expenses plus Income/Bills/Goals) and that section actions name their
  interaction rather than a generic "Manage."
- `specs/README.md`: index entry for 023.

## Verification
`npm run dev`: confirm the Budget heading and an "Edit budget" link; the
four cards (Income, Bills, Expenses, Goals) with "Add income", "Add
bill", "Log expense", "Check off" actions; the Expenses card showing the
month's total and an empty state at zero; and the grid collapsing to two
columns at tablet/phone width. Check both themes and phone width. Run
`npm test`, `npm run test:e2e`, `npm run lint`, and `npm run build`.
