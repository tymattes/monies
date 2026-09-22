# 019: Expenses — logging actual spend against a category

**Status:** draft

## Goal
Every other number in this app is a plan: a category's budget, a bill's
recurring charge, a goal's monthly target. None of it is a *fact* about
money that actually left the household — the brief's "Dashboards: budget
vs. actual" has had nothing to compare "budget" against, and the
Overview categories table has said so out loud since spec 008: "Actual
spending will appear here once transactions arrive." This spec is that
arrival: a lightweight expense log, entered by hand (no receipt capture —
the brief already scoped that out as later work), that counts against a
category's budget the same way a bill's monthly cost already does. It's
the last major new concept before the household model is complete;
specs 020 and 021 build on it.

## Requirements
- **A household member can log an expense**: an amount, a category, and
  a date it happened. Nothing else — no merchant, no note, no receipt,
  no splitting one purchase across categories. If a category's needed,
  a second expense is two clicks away.
- **An expense counts against its category's budget**, alongside bills,
  the same way bills already do: a category's remaining budget becomes
  `budgeted − bills − expenses` instead of just `budgeted − bills`.
  Logging more than a category has left is allowed and shows the same
  over-budget red treatment a bill exceeding its budget already gets —
  the app never refuses to record a real purchase.
- **Expenses are facts, not plans.** Unlike a budget or bill amount, an
  expense isn't time-versioned and past months aren't read-only for it —
  you can log (or delete) an expense for any date up to and including
  today, the same reasoning goal check-ins already use (spec 014): it
  records something that happened, not a decision about the future. A
  future-dated expense is rejected — nothing has happened yet to record.
- **A new "Expenses" page**, easy entry front and center: pick a
  category, type an amount, a date (defaulting to today), submit. Below
  it, a list of the month's logged expenses with a delete button on
  each, and the same month-navigation every other page in this app has.
- **"Expenses" becomes a new top-level nav destination**, alongside
  Overview, Plan and Members (still within the five-or-fewer budget).
  It is not a Plan tab: Plan is what you intend to spend, Expenses is
  what you did spend, the same distinction that already puts Goals'
  checkmark and Bills' recurring charge in different places.

## Out of scope
- Editing a logged expense. Delete and re-add covers a mistake; a
  full edit form is more form than "easy entry" needs for a first
  version, and can follow later if it turns out to matter.
- A note, merchant, or receipt field, or splitting one expense across
  multiple categories — deliberately deferred, see Decisions.
- Receipt capture / photographing a receipt to auto-fill the form — the
  brief already scoped this to a later spec.
- Any change to how Bills work, or to Assign — that's spec 020.
- Overview's cash-flow card, its attention items, or the categories
  table's bar and caption — that's spec 021, once this exists to build
  on.
- Per-member expense views/attribution beyond "who logged it" (informational
  only, same as a bill's `added_by`) — household-level totals only.

## Acceptance criteria
- [x] `expenses` table exists (`category_id`, `amount_cents` with a
      `>= 1` check, `spent_on` date, `added_by`, `created_at`); deleting
      a category cascades its expenses, same as budget allocations.
- [x] `POST /api/expenses` creates an expense for a category visible in
      `spentOn`'s month; rejects an unknown/foreign/archived-then category,
      an amount below 1, or a malformed date.
- [x] `DELETE /api/expenses/[id]` removes only the caller's household's
      expense; any household member can delete any expense (informational
      `added_by`, same as bills).
- [x] `GET /api/expenses/month/[month]` lists that month's expenses,
      newest first, for the household.
- [x] `getBudget`'s per-category `remainingCents` is
      `amountCents − billsCents − expensesCents`; `Budget` gains a
      household-wide `expensesTotalCents` alongside `billsTotalCents`.
      Logging an expense larger than what's left still succeeds and
      shows as negative "Left", not an error.
- [x] A past month accepts a new or deleted expense (unlike a budget or
      bill change); a future-dated expense is rejected.
- [x] The Expenses page: the quick-entry form defaults the date to
      today, lists the month's entries with working delete, and its
      `MonthNav` keeps state the way Budget/Bills/Income/Goals already do.
- [x] `HeaderNav` shows Overview, Plan, Expenses, Members; "Expenses" is
      current on `/expenses`.
- [x] Documentation updated (see Documentation).

## Technical notes
- **Schema** (`src/db/schema.ts`), modeled on `income_deposits` (a
  point-in-time logged amount, spec 006) rather than
  `budget_allocations` (a time-versioned plan): `expenses` table with
  `id`, `category_id` (fk → `categories`, `onDelete: "cascade"`),
  `amount_cents` (integer, `check ... >= 1`, same as
  `income_deposits_amount_check`), `spent_on` (`date`, mode `"string"`),
  `added_by` (fk → `user`, `onDelete: "set null"`, informational — same
  "Former member" treatment bills already give a removed member),
  `created_at`. Index on `(category_id, spent_on)`, mirroring
  `income_deposits_source_received_idx`. The amount check is `> 0` to
  match `income_deposits_amount_check` exactly (integer, so equivalent to
  "at least 1").
- **`src/lib/expenses.ts`** (new), shaped like `income.ts`'s deposit
  functions: `addExpense(ctx, { categoryId, amountCents, spentOn })`
  loads the category scoped to the household and checks
  `visibleIn(spentOn.slice(0, 7))` (the same helper `budgets.ts` already
  has for "is this category shown in this month" — it is duplicated in
  `budgets.ts`, `income.ts` and `goals.ts` already; duplicate it here too
  rather than block this spec on a cross-file refactor, and note the
  consolidation as a follow-up chore); `deleteExpense(ctx, id)` loads-then-deletes, checking
  household ownership via a join, same shape as `income.ts`'s
  `loadDeposit`. No `updateExpense` (Out of scope). A
  `getExpensesMonth(ctx, month)` returns the month's rows joined with
  category name, newest-`spent_on`-first.
- **Routes**: `POST /api/expenses` (create); `DELETE /api/expenses/[id]`;
  `GET /api/expenses/month/[month]` — nested under a static `month`
  segment, the same reason goals' routes are
  (`/api/goals/month/[month]/...`): so Next doesn't see `[id]` and
  `[month]` colliding at the same path level. `parseAmount(value, 1)`
  and `parseDate` (`src/lib/months.ts`) cover validation; no new shared
  validators needed.
- **`src/lib/budgets.ts` `getBudget`**: add an `expensesCents` SQL
  rollup per category (sum of `expenses.amount_cents` where
  `date_trunc('month', spent_on) = monthStart(month)`), the same shape
  as the existing `billsRollup` in `bills.ts`. `BudgetLine.remainingCents`
  becomes `amountCents - billsCents - expensesCents`; `Budget` gains
  `expensesTotalCents` (sum across categories, parallel to
  `billsTotalCents`). `totalCents` (categories' budgeted sum) is
  unaffected by any of this. **`unallocatedCents` is out of scope for
  this spec** — see spec 022, discovered while drafting this one: it
  turns out a category's budgeted amount shouldn't reserve income at
  all, and `expensesTotalCents` becomes a term in `unallocatedCents`'s
  formula there instead. This spec only needs `expensesTotalCents` to
  exist and be correct; 022 is what wires it in.
- **`src/app/expenses/page.tsx`** (new) + **`ExpenseLog.tsx`** (new
  component): shaped like `IncomeView`'s deposit form/list for a
  variable source — a form (category `<select>`, amount `<input>`, date
  `<input type="date">` defaulting to `currentDate()`, submit) above a
  list of the month's expenses (date, category, amount, a per-row Delete
  button), with `MonthNav` the same as Budget/Bills/Income/Goals.
- **`src/components/HeaderNav.tsx`**: add `{ href: "/expenses", label:
  "Expenses" }` between Plan and Members.
- **Tests**: new `tests/expenses.test.ts` (CRUD, household scoping,
  archived-category rejection, past-month acceptance, the
  `remainingCents`/`expensesTotalCents` math); extend
  `tests/budgets.test.ts` for the new `getBudget` fields; a small
  `tests/expenses-ui.test.tsx` or addition to `tests/plan-ui.test.tsx`
  for `HeaderNav`'s new item.

## Decisions
- **No note/merchant field, no split-across-categories, no edit.** Every
  one of these turns a two-field quick-entry form into something closer
  to a transaction ledger — real scope, not a small addition. "Easy
  expense entry" is the actual ask here; a fuller ledger (with search,
  notes, editing) is worth its own spec once logging expenses at all has
  been lived with for a while and a real need for more shows up.
- **Expenses count against a category's budgeted target for comparison
  purposes, the same way bills already do — but see spec 022 for what
  that target actually means.** Originally this spec assumed a
  category's budgeted amount reserves money out of income and expenses
  just spend down that reservation, leaving Unallocated's formula
  untouched. Working through the Assign/Expenses interaction properly
  (spec 020) surfaced that budgeted amounts were never supposed to
  reserve anything — only Bills, Expenses and checked-off Goals should.
  That correction is spec 022's job, not this one's; this spec still
  only needs `remainingCents`/`expensesCents` to exist correctly at the
  category level for the budget-vs-actual comparison, independent of
  how Unallocated itself is computed.
- **No blocking on overspend.** A real purchase already happened by the
  time it's logged; refusing to record it because it exceeds the budget
  would just make the log inaccurate. Overspend is visible (negative
  Left, red) rather than prevented — the same choice bills already made.
- **Expenses is a 4th top-level destination, not a Plan tab.** Plan
  (Budget/Bills/Income/Goals) is entirely about *intent* — what you mean
  to do with money each month. An expense is the opposite: a fact about
  something that already happened. Goals draw the same line with its
  checkmark (spec 014's "did I do this," separate from its planned
  amount); Expenses is that same distinction made into its own page
  rather than folded into Plan.
- **Any month up to today, not future months.** The existing "past months
  are read-only" rule exists to keep *plans* (budgets, bill amounts) from
  rewriting history. An expense is the history — the same reasoning that
  lets a goal's checkmark be set for any month already applies. Future
  dates are the exception: nothing has happened yet to record, so the
  date field is capped at today (matching the spec's "facts, not plans"
  framing).

## Documentation
- `README.md`: add an "Expenses" feature bullet (spec 019) describing
  the quick-entry form, that expenses count against a category's budget
  like bills do, and that overspend shows rather than blocks; update the
  Navigation description (four top-level destinations, not three).
- `CLAUDE.md`: add an Expenses invariant bullet (table shape, the
  `visibleIn`-any-month rule, `remainingCents`'s new formula,
  `expensesTotalCents`); update the Navigation bullet's destination
  count and list.

## Verification
`npm run dev`: log an expense against a category with room left, confirm
its Left drops by that amount on Budget; log one that exceeds what's
left and confirm Left goes negative in red without an error. Delete an
expense and confirm Left recovers. Navigate to a past month and confirm
logging and deleting both still work there. Confirm the date field
defaults to today and a different date files the expense into the right
month. Confirm HeaderNav shows Overview / Plan / Expenses / Members, in
that order, with Expenses current on `/expenses`. Check both themes and
phone width. Run `npm test`, `npm run test:e2e`, `npm run lint`, and
`npm run build`.
