---
paths:
  - "src/lib/expenses.ts"
  - "src/app/api/expenses/**"
  - "src/app/expenses/**"
  - "src/components/{ExpenseLog,BudgetEditor}.tsx"
  - "src/components/overview/{ExpensesList,CategoryTable}.tsx"
  - "tests/expense*.test.*"
---

# Expenses

- Expenses (`src/lib/expenses.ts`, spec 019): a logged fact — money spent on a category on a date, in an `expenses` table (`category_id` cascade, `spent_on` date, `amount_cents > 0`, optional `description` text trimmed/capped at 200 chars via `parseNote`, `added_by` set-null). Not time-versioned and not read-only for past months: any date up to today is accepted, a future date is rejected. A category's `remainingCents` is `budgeted − bills − expenses`, and `Budget.expensesTotalCents` sums the month's spend (a term in `unallocatedCents` since spec 022). `BudgetEditor` (`/budget`) shows Bills and Expenses columns and computes "Remaining" the same way, matching the Hub's `CategoryTable`, which also renamed its "Left" column to "Remaining" (spec 038). Routes: `POST /api/expenses`, `DELETE /api/expenses/[id]`, `GET /api/expenses/month/[month]`.
