---
paths:
  - "src/lib/{goals,goalTypes,expenses,bills,categories,income,validate,budgets}.ts"
  - "src/app/api/{goals,expenses,bills,categories,income,budgets}/**"
  - "src/app/{goals,expenses,bills,income}/**"
  - "src/components/{GoalEditor,GoalManager,ExpenseLog,BudgetEditor,BillsView,IncomeView,AssignUnallocated}.tsx"
  - "src/components/overview/{GoalsCard,ExpensesList,CategoryTable,BillsCard,IncomeCard}.tsx"
  - "tests/{goals*,expense*,bills,income,assign*}.test.*"
  - "e2e/{goals,bills,assign}.spec.ts"
---

# Budget domain: goals, expenses, bills, income, assign

## Goals

- `src/lib/goals.ts`: `saving` | `debt payoff`, in separate tables `goals`/`goal_amounts`/`goal_checkins`. `goal_amounts` is time-versioned like `budget_allocations`. `goal_checkins` is a presence record: any month can be checked, including past ones.
- `goals.note` is optional free text (trimmed, capped at 200 chars via `parseLabel`, spec 040). `GoalManager` drafts name/type/note locally and commits them together with one Save button per row, not per-field auto-save. `GoalEditor` shows the note read-only under the goal's name; the Hub's `GoalsCard` doesn't show it.
- `GOAL_TYPES`/`TYPE_LABELS`/`groupByType` live in `src/lib/goalTypes.ts`, which has no DB import so client components can use it.
- `GoalEditor` calls `router.refresh()` after a successful check-off toggle or amount save so the server-rendered Plan summary stays current (spec 024).

## Expenses

- `src/lib/expenses.ts` (spec 019): a logged fact, money spent on a category on a date. Table `expenses`: `category_id` cascade, `spent_on` date, `amount_cents > 0`, optional `description` (trimmed, capped at 200 chars via `parseNote`), `added_by` set-null.
- Not time-versioned and not read-only for past months: any date up to today is accepted, a future date is rejected.
- A category's `remainingCents` is `budgeted − bills − expenses`. `Budget.expensesTotalCents` sums the month's spend and is a term in `unallocatedCents` (spec 022).
- `BudgetEditor` (`/budget`) shows Bills and Expenses columns and computes "Remaining" the same way as the Hub's `CategoryTable`; both label the column "Remaining" (spec 038).
- Routes: `POST /api/expenses`, `DELETE /api/expenses/[id]`, `GET /api/expenses/month/[month]`.

## Bills

- `src/lib/bills.ts`: amount, period (`interval_months` 1/3/6/12) and category are versioned together in `bill_versions`, with the same latest-effective-month and read-only-past rules.
- The monthly equivalent is computed, never stored, in `monthlyEquivalent` and in the SQL of `activeBills`. Keep the two in sync; `tests/bills.test.ts` compares them.
- `updateCategory` refuses to archive a category while bills use it or will move into it.
- `bills.paid_by` (spec 043) is a nullable member reference (`ON DELETE SET NULL`). It is optional from the start, unlike `added_by`, so null means either "no payer chosen" or "payer removed" and both render as no payer. There is no "Former member" case for it.

## Income

- `src/lib/income.ts`: fixed sources keep a time-versioned amount in `income_amounts`; variable sources record actual `income_deposits`, counted in the month of `received_on`.
- `assertCanEdit` allows an owner, or the source's own member. Removed members' sources have `member_id` null and are owner-only. Shared validators are in `src/lib/validate.ts`.
- Provisional income (spec 010): `getIncomeMonth` sets `provisional` for the current or a later month when a variable source is active. It changes wording, tone and severity only, never amounts; `category_over_budget` is never softened.

## Assign unallocated

- `assignUnallocated` in `src/lib/budgets.ts`, `POST /api/budgets/[month]/assign-unallocated`: adds leftover income to goals only, as normal allocations from that month onward, all-or-nothing, under a `pg_advisory_xact_lock` keyed on household and month.
- Assign never touches a category's budget; only a manual edit on Budget does (spec 020). A `categoryId` anywhere in the body returns a named 400 pointing at Expenses.
- Assign is a one-month top-up, not a permanent raise (spec 017).
- The panel is `src/components/AssignUnallocated.tsx` at `#assign`, near the top of `/goals` (spec 032). On success it confirms in its footnote and resets its rows to empty, so a repeat click can't double up the same goal. The confirmation doesn't link to Goals, since the panel already lives there.
