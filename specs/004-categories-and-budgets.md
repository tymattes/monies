# 004: Categories and monthly budgets

**Status:** approved

## Goal
Let a household define spending categories and set a monthly budget amount for each, with changes over time preserved so past months stay accurate. Supports `brief.md`: monthly, category-driven budgets whose allocations change over time while history is preserved. This spec covers the plan only (what the household intends to spend). Actual spend arrives with transactions in a later spec, which is what makes "budget vs. actual" possible.

## Requirements

### Categories
- A category belongs to the household and has a name (unique among the household's active categories, case-insensitive) and a sort position.
- Members can create, rename, reorder and archive categories. Archiving hides a category from the current month forward; it is never hard-deleted, so past months and later transactions keep resolving it.
- Renaming applies everywhere, including past months (the category is the same thing, only its label changed).
- Expense categories only. Income is modelled per member in its own spec, not as categories.
- On first-run setup, a starter set is created (Housing, Groceries, Dining out, Transport, Utilities, Health, Entertainment, Savings, Other) so the budget page is not empty. All of it is editable.

### Allocations (time-versioned)
- An **allocation** is a monthly amount for a category, effective from a given month onward.
- The amount for category C in month M is the allocation for C with the latest `effective_month` that is on or before M. If none exists, the amount is 0.
- Setting an amount for month M writes an allocation with `effective_month = M`, replacing any allocation already at exactly M. Months before M are unaffected. Months after M take the new value until the next explicit allocation.
- Only the current month and future months can be changed. Past months are read-only, so history cannot be rewritten. This is the mechanism that keeps past months accurate.
- Each new month inherits the previous month's amounts automatically (no copy step) because of the lookup rule above.
- Amounts are non-negative integers in the household currency's minor unit (cents), never floats.

### Budget view
- A Budget page shows one month at a time with previous/next month navigation, defaulting to the current month.
- It lists active categories with their amount for that month (and archived categories that were active in that month, for past months), and shows the month's total budgeted.
- Editing an amount on the current or a future month saves it "from this month onward" and says so in the UI. Past months show amounts read-only.
- Navigating far into the future is allowed (allocations just carry forward); navigating before the household was created shows nothing to edit.

### API
- `GET /api/categories` and `POST /api/categories`.
- `PATCH /api/categories/[id]` for rename, reorder and archive/unarchive.
- `GET /api/budgets/[month]` where month is `YYYY-MM`: categories with their effective amount, plus the total.
- `PUT /api/budgets/[month]/allocations/[categoryId]` with `{ amountCents }`; rejects past months.
- All routes use `requireHousehold()` and are household-scoped.

### Currency
- The household has a single currency (ISO 4217 code, default `USD`), chosen at setup and shown on the budget page. Multi-currency is out of scope. Stored on `households` via an additive migration.

## Out of scope
Transactions and actual spend, budget vs. actual, rollover of unspent amounts, income, category groups or nesting, per-month one-off overrides (see Open questions), recurring bills, savings goals, multi-currency, import/export, dashboards.

## Acceptance criteria
- [ ] Setup creates the starter categories; they appear on the Budget page.
- [ ] A member can add, rename, reorder and archive categories; names are unique per household (case-insensitive).
- [ ] Setting an amount for the current month persists and carries into later months with no explicit allocation.
- [ ] Changing an amount in a future month leaves earlier months unchanged.
- [ ] Changing the current month's amount does not alter past months (covered by a test that reads a past month before and after).
- [ ] Setting an amount for a past month is rejected by the API and read-only in the UI.
- [ ] Archiving a category hides it from the current month forward but past months still show it with its old amount.
- [ ] Amounts are stored as integer cents; negative and non-integer values are rejected.
- [ ] All new routes reject signed-out users and non-members (covered by tests).
- [ ] Migration is additive and idempotent on restart; existing households get the default currency and no categories are auto-created for them.
- [ ] Documentation updated as listed under Documentation.
- [ ] `npm run lint`, `npm test` and `npm run build` pass.

## Technical notes
- Tables (proposal): `categories` (id uuid, household_id, name, position, archived_at nullable, created_at), `budget_allocations` (id uuid, category_id, effective_month date, amount_cents integer check >= 0, created_by, created_at) with a unique index on `(category_id, effective_month)`.
- `effective_month` is a `date` always set to the first of the month. The month key in the API is `YYYY-MM`; validate strictly.
- Effective amount query: for each category, the allocation with the greatest `effective_month <= month` (a lateral join or `distinct on (category_id) ... order by effective_month desc`). One query per month view.
- "Current month" is computed on the server. See Open questions on timezone.
- A category is shown in month M unless it was archived at or before the start of M. Store `archived_at` as a timestamp and compare its month to M.
- Uniqueness of active names: a partial unique index on `(household_id, lower(name)) where archived_at is null`.
- Starter categories are created by `runSetup` in the same transaction as the household.
- Reuse `requireHousehold()` and `route()` from spec 003; add tests alongside `tests/households.test.ts` in a new file.
- Read `node_modules/next/dist/docs/` before adding new route handlers or pages.
- Keep the UI plain and functional. Visual polish and charts follow the UX trends research and the dashboards spec.

## Decisions
- Every household member can manage categories and budgets. Owners still manage members and invites.
- Keep the proposed starter categories.
- "Current month" uses the server's timezone (`TZ`, default UTC in Docker), documented in the README. The app is intended to be hosted locally; a per-household timezone can come later if needed.
- Single household currency (default USD, chosen at setup) is enough for now.
- "From this month onward" is the only edit; no "just this month" option.
- Carried into the income spec (not built here): owners can edit income for every member, while members edit their own.

## Documentation
- `README.md`: add categories and monthly budgets to Features (how allocations carry forward, past months read-only), document the timezone/`TZ` behavior and the household currency, move it out of "Planned", update the status line.
- `CLAUDE.md`: architecture note on time-versioned allocations and the effective-amount lookup, and any new commands.

## Verification
Fresh `docker compose up --build`: complete setup and confirm starter categories. Set Groceries for this month, move to next month and confirm it carried over. Change next month's amount and confirm this month is unchanged. Confirm past months are read-only, archive a category and confirm it disappears from this month but shows in last month if it had an allocation there. Run tests, lint and build.
