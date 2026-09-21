# 006: Income per member

**Status:** implemented

## Goal
Let each household member have income, both fixed monthly (salary) and variable (freelance, bonuses, irregular deposits), so the household can see what is coming in each month. Supports `brief.md`: income is set per household member and supports fixed and variable income. It also sets up the "income vs. spend" dashboard and lets the Budget page show how much of the month's income is still unallocated.

## Requirements

### Income sources
- An **income source** belongs to a household member (or to nobody, see Removed members) and has a name (e.g. "Salary", "Freelance") and a kind: `fixed` or `variable`. A member can have any number of sources of either kind.
- Sources can be created, renamed and archived. Archiving hides a source from the current month forward; it is never hard-deleted (same rule as categories in spec 004).
- Source names are unique per member among active sources, case-insensitive.

### Fixed income (time-versioned)
- A fixed source has a monthly amount that is effective from a month onward, using the same model as budget allocations in spec 004: a month's amount is the latest amount on or before it (0 if none), so it carries forward until changed.
- Only the current and future months can be changed; past months are read-only so history stays accurate.
- Amounts are non-negative integers in the household currency's minor unit.

### Variable income (actual deposits)
- A variable source has no planned amount. Members record **deposits**: a date received, an amount greater than 0, and an optional note.
- A deposit counts toward the calendar month of its date. Deposits can be added for any date, past or future, since they are records of what actually happened; they can be edited or deleted to fix mistakes.

### Month view
- An Income page shows one month at a time (previous/next, defaulting to the current month), grouped by member, with each source's amount for that month, a total per member, and a household total. Variable sources show that month's deposits.
- The Budget page shows the month's household income and the amount still unallocated (income minus total budgeted, which may be negative and is then flagged as over-allocated).

### Permissions
- Everyone in the household can see all members' income (household first).
- Owners can create and edit income for every member. Regular members can create and edit only their own.
- Enforced in the API, not only the UI.

### Removed members
- Removing a member deletes their user row (spec 003). Their income sources and history must survive, so a source's `member_id` is set to null on removal and it displays as "Former member". Owners can still archive or edit these sources; no regular member can.

### API
- `GET /api/income/[month]`: sources with the month's amount (fixed) or deposits (variable), per-member totals and the household total.
- `GET /api/income/sources` and `POST /api/income/sources` (`{ name, kind, memberId? }`, `memberId` defaults to the caller and only an owner may set another member).
- `PATCH /api/income/sources/[id]`: rename, archive or restore.
- `PUT /api/income/[month]/sources/[id]`: set a fixed source's amount from that month onward; rejects past months and variable sources.
- `POST /api/income/sources/[id]/deposits`, `PATCH` and `DELETE /api/income/deposits/[id]`.
- All routes use `requireHousehold()` plus an ownership check (owner, or the source's own member).

## Out of scope
Bank sync or matching deposits to real accounts, gross vs. net and tax calculations, pay frequencies other than monthly (see Decisions), expected amounts for variable income, recurring deposits, income categories or tags, per-member dashboards (the dashboards spec builds on this), multi-currency, import/export.

## Acceptance criteria
- [x] A member can create fixed and variable income sources for themselves; an owner can do so for any member; a regular member cannot for someone else (covered by tests).
- [x] Setting a fixed amount for the current month carries into later months and leaves past months unchanged; past months reject edits (covered by tests, mocking the current month as in spec 004).
- [x] Setting an amount on a variable source, or a deposit on a fixed source, is rejected.
- [x] Deposits count in the month of their date; adding, editing and deleting them updates that month's totals only.
- [x] Month view shows per-member and household totals combining fixed amounts and variable deposits.
- [x] Budget page shows household income and unallocated for the month.
- [x] Everyone in the household can view all income; signed-out users and non-members are rejected on every route.
- [x] Removing a member keeps their sources and history as "Former member" (covered by a test); only owners can edit those.
- [x] Amounts are integer minor units; negative, fractional and zero deposit values are rejected.
- [x] Migration is additive and idempotent on restart; existing households simply have no income yet.
- [x] New UI works in light and dark themes using the theme tokens (spec 005).
- [x] Documentation updated (see Documentation).
- [x] `npm run lint`, `npm test` and `npm run build` pass.

## Technical notes
- Tables: `income_sources` (id uuid, household_id, member_id text nullable fk user `on delete set null`, name, kind `fixed`|`variable`, start_month date, archived_from date nullable, created_at), `income_amounts` (id, source_id, effective_month date, amount_cents integer check >= 0, created_by, created_at; unique on `(source_id, effective_month)`; fixed sources only), `income_deposits` (id, source_id, received_on date, amount_cents integer check > 0, note text nullable, created_by, created_at).
- Reuse the spec 004 patterns: `YYYY-MM` months and `date` columns from `src/lib/months.ts`, integer money from `src/lib/money.ts`, the latest-effective-month lookup, and archive-by-month visibility (`start_month <= M < archived_from`).
- Ownership check helper next to `requireHousehold()`: allowed when the caller is an owner or `source.member_id === ctx.user.id`; ownerless sources are owner-only.
- Fixed and variable are stored in separate tables so each keeps a simple shape; a source's `kind` is fixed at creation.
- `removeMember` deletes the user row; the `set null` foreign key preserves sources. The `income_amounts.created_by` and `income_deposits.created_by` columns also use `set null`.
- Tests that depend on "today" mock `currentMonth` as in `tests/budgets.test.ts`; put the new tests in their own file and reuse `tests/helpers.ts`.
- Read `node_modules/next/dist/docs/` before adding new route handlers or pages, and use only theme tokens for colors.

## Decisions
- Every member can see every member's income (household first).
- Income is recorded as net take-home and the UI says so.
- Monthly amounts only; someone paid more often enters their average monthly take-home. Other pay frequencies can be their own spec.
- Variable income is actual deposits only, with no expected amount.
- The Budget page shows household income and unallocated, in this spec.
- A removed member's income history is kept and shown as "Former member".

## Documentation
- `README.md`: add Income to Features (fixed vs. variable, who can edit what, carry-forward and read-only past months, unallocated on the Budget page), move it out of "Planned".
- `CLAUDE.md`: architecture note on the income tables, the ownership check helper, the removed-member `set null` behavior, and the updated product constraint wording if anything changes.

## Verification
Fresh `docker compose up --build`: as the owner, add a Salary (fixed) for yourself and a Freelance (variable) source for a second member. Set the salary for this month and confirm it carries into next month while last month stays unchanged. Record two deposits in different months and confirm each lands in its own month. Sign in as the second member and confirm they can edit their own income but not the owner's, and can see everyone's. Confirm the Budget page shows income and unallocated. Remove the second member and confirm their income remains as "Former member" and only the owner can edit it. Check the pages in light and dark themes. Run tests, lint and build.

## Implementation notes
- Deposits are only accepted for months where the source is active (`start_month <= month < archived_from`), so a deposit can never become hidden by archiving, and a source can't receive money from before it existed.
- The API supports editing (`PATCH`) and deleting deposits and renaming sources. The UI currently offers add and delete for deposits and add and archive for sources; to correct a deposit, delete and re-add it, and renaming a source is API-only for now.
- `GET /api/budgets/[month]` also returns `incomeCents` and `unallocatedCents`, so a future client gets the same numbers as the Budget page. Unallocated is negative when the budget exceeds income and is shown as "Over-allocated by".
- Month view groups are the current members in join order, then a "Former member" group when any visible source has no member. Members with no income yet still appear so owners can add income for them.
- `MonthNav` is now shared by the Budget and Income pages.
- Verified: the migration applied to a database with an existing household and categories leaves them intact and adds empty income tables.

## Not verified
The Income page and the new Budget rows were not exercised in a real browser (typing amounts, save on blur, the deposit form, light vs. dark appearance). They use only theme tokens (checked by search for hardcoded colors) and render with the expected content when fetched. The routes and behavior are covered by 30 new tests plus a curl run against a scratch instance with two members.
