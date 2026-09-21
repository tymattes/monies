# 006: Income per member

**Status:** draft

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
Bank sync or matching deposits to real accounts, gross vs. net and tax calculations, pay frequencies other than monthly (see Open questions), expected amounts for variable income, recurring deposits, income categories or tags, per-member dashboards (the dashboards spec builds on this), multi-currency, import/export.

## Acceptance criteria
- [ ] A member can create fixed and variable income sources for themselves; an owner can do so for any member; a regular member cannot for someone else (covered by tests).
- [ ] Setting a fixed amount for the current month carries into later months and leaves past months unchanged; past months reject edits (covered by tests, mocking the current month as in spec 004).
- [ ] Setting an amount on a variable source, or a deposit on a fixed source, is rejected.
- [ ] Deposits count in the month of their date; adding, editing and deleting them updates that month's totals only.
- [ ] Month view shows per-member and household totals combining fixed amounts and variable deposits.
- [ ] Budget page shows household income and unallocated for the month.
- [ ] Everyone in the household can view all income; signed-out users and non-members are rejected on every route.
- [ ] Removing a member keeps their sources and history as "Former member" (covered by a test); only owners can edit those.
- [ ] Amounts are integer minor units; negative, fractional and zero deposit values are rejected.
- [ ] Migration is additive and idempotent on restart; existing households simply have no income yet.
- [ ] New UI works in light and dark themes using the theme tokens (spec 005).
- [ ] Documentation updated (see Documentation).
- [ ] `npm run lint`, `npm test` and `npm run build` pass.

## Technical notes
- Tables (proposal): `income_sources` (id uuid, household_id, member_id text nullable fk user `on delete set null`, name, kind `fixed`|`variable`, start_month date, archived_from date nullable, created_at), `income_amounts` (id, source_id, effective_month date, amount_cents integer check >= 0, created_by, created_at; unique on `(source_id, effective_month)`; fixed sources only), `income_deposits` (id, source_id, received_on date, amount_cents integer check > 0, note text nullable, created_by, created_at).
- Reuse the spec 004 patterns: `YYYY-MM` months and `date` columns from `src/lib/months.ts`, integer money from `src/lib/money.ts`, the latest-effective-month lookup, and archive-by-month visibility (`start_month <= M < archived_from`).
- Ownership check helper next to `requireHousehold()`: allowed when the caller is an owner or `source.member_id === ctx.user.id`; ownerless sources are owner-only.
- Fixed and variable are stored in separate tables so each keeps a simple shape; a source's `kind` is fixed at creation.
- `removeMember` deletes the user row; the `set null` foreign key preserves sources. The `income_amounts.created_by` and `income_deposits.created_by` columns also use `set null`.
- Tests that depend on "today" mock `currentMonth` as in `tests/budgets.test.ts`; put the new tests in their own file and reuse `tests/helpers.ts`.
- Read `node_modules/next/dist/docs/` before adding new route handlers or pages, and use only theme tokens for colors.

## Open questions
1. **Visibility:** proposal is that every member can see every member's income, which fits a household budget and the household-level dashboards. The alternative is private per-member income with only totals shared. Recommendation: visible to all.
2. **Net or gross:** proposal is to record take-home (net) income, since that is what funds the budget, and to say so in the UI. Recommendation: net.
3. **Pay frequency:** proposal is monthly amounts only; someone paid every two weeks enters their average monthly take-home. Weekly or biweekly conversion (26 pays a year makes some months have three) is more work and can be its own spec. Recommendation: monthly only for now.
4. **Variable income planning:** proposal is actuals only, with no expected monthly amount. The tradeoff is that a month with no deposits yet shows 0 for that source. Recommendation: actuals only until dashboards show a need for forecasts.
5. **Unallocated on the Budget page:** include income and unallocated on the Budget page in this spec (proposed), or leave it for the dashboards spec? Recommendation: include, it is small and immediately useful.
6. **Former members:** keep their income history as "Former member" (proposed), or delete it along with them? Recommendation: keep, so past months stay accurate.

## Documentation
- `README.md`: add Income to Features (fixed vs. variable, who can edit what, carry-forward and read-only past months, unallocated on the Budget page), move it out of "Planned".
- `CLAUDE.md`: architecture note on the income tables, the ownership check helper, the removed-member `set null` behavior, and the updated product constraint wording if anything changes.

## Verification
Fresh `docker compose up --build`: as the owner, add a Salary (fixed) for yourself and a Freelance (variable) source for a second member. Set the salary for this month and confirm it carries into next month while last month stays unchanged. Record two deposits in different months and confirm each lands in its own month. Sign in as the second member and confirm they can edit their own income but not the owner's, and can see everyone's. Confirm the Budget page shows income and unallocated. Remove the second member and confirm their income remains as "Former member" and only the owner can edit it. Check the pages in light and dark themes. Run tests, lint and build.
