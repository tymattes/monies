# 007: Monthly expenses, assign-to-savings, and a Dracula dark theme

**Status:** draft

## Goal
Three related improvements before receipt capture, all about making the monthly budget more useful and the app nicer to live in:

- **A. Monthly expenses.** The household records its recurring monthly bills once (rent, subscriptions, phone, utilities), each tagged with who added it and a category the user is prompted to choose. Every month those expenses count against their category automatically, without logging each one. This brings over the "Monthly Expenses" idea from the owner's Notion Finances doc: a list of recurring items with a type, an amount, a payment method and a comment, rolled up against income into what is left to spend or save (Notion's "Monthly Cash Flow").
- **B. Assign unallocated to a category.** A one-click way to put the month's leftover (unallocated) budget into Savings or any other category, instead of defaulting it silently. See the discussion in the Decisions section.
- **C. Dracula dark theme.** Replace the dark palette with the widely used Dracula palette.

Supports `brief.md`: category-driven budgets, modern UX, and a path to budget vs. actual (recurring expenses are the first source of "actual").

## Requirements

### A. Monthly expenses
- A **monthly expense** is a recurring cost of the household that counts against the budget every month. It has: a name, the **bill amount** and **how often it is billed**, a **category** (required), an optional **paid with** label (free text, e.g. "Checking", "Amazon card"), an optional note, and **added by** (the member who created it).
- **The category is required and the user is prompted to choose it** when creating an expense: the field starts empty with a "Choose a category" prompt, so nothing is assigned by default. Only active categories are offered.
- **Time-versioned like budgets and income.** The amount, billing period and category are versioned together, effective from a month onward: a month's values are the latest version on or before it. Changing an amount or billing period, or moving an expense to another category, applies from a chosen month forward, never rewriting past months. Only the current and future months can be changed.
- **Billing period.** An expense can be billed **monthly, every 3 months, every 6 months, or yearly**. The user enters the real bill (e.g. 120.00 every 12 months) and never the monthly figure. The form shows a live preview ("= 10.00 / month"). The **monthly equivalent** is the bill divided by the number of months, rounded to the nearest minor unit, and that is what counts against the category in every month the expense is active. So a yearly subscription is spread evenly across the whole year instead of landing in its renewal month.
- **Every month the expense counts against its category** for each month it is active, with no per-month entry. The amount may be 0 (a placeholder or a paused bill). Amounts shown in lists include both the bill and its monthly equivalent (e.g. "120.00 / year, about 10.00 / month"); all totals and category rollups use monthly equivalents.
- Expenses can be renamed, have their paid-with label and note edited, and be **ended** (archived from a month onward; history stays). Ending an expense is how a cancelled subscription stops counting.
- **Added by** is shown on each expense. If that member is later removed, it shows "Former member" and the expense stays (same behavior as income).
- **Who can edit:** every household member can add, edit and end any expense (household bills are shared). The added-by tag is informational, not a permission.
- A category with active monthly expenses cannot be archived until they are moved or ended; the error names how many expenses block it.
- **Expenses page.** One month at a time (previous/next), listing that month's expenses with amount, category, paid with, note and added by, grouped by category with subtotals and a month total. A form adds an expense (name, amount, category prompt, paid with, note). Paid-with offers the household's previously used labels as suggestions.
- **Budget page integration.** Each category row gains what is committed and what remains: **Budgeted**, **Monthly expenses**, **Remaining** (budgeted minus expenses; negative is flagged in the error color as over). The page summary adds **Monthly expenses** total and **Left after monthly expenses** (income minus monthly expenses), which mirrors the Notion "Spending/Saving" figure. The existing income and unallocated lines stay.

### B. Assign unallocated
- When the month's unallocated amount is greater than 0 and the month is editable, the Budget page shows an **Assign to…** control next to it: a category select preselected to the category named "Savings" (case-insensitive) if one exists, otherwise showing a "Choose a category" prompt, and a button.
- Assigning adds the current unallocated amount to that category's amount for this month, from this month onward (the same effect as typing it in), and the unallocated line drops to 0.
- It is an ordinary allocation afterwards: editable, and it appears in history like any other. Nothing is assigned automatically.
- Done in one database transaction so two clicks or two members cannot double-assign.

### C. Dracula dark theme
- The dark theme uses the official Dracula palette (source under Technical notes): background `#282A36`, foreground `#F8F8F2`, surfaces and borders `#44475A`, with green `#50FA7B` as the accent, red `#FF5555` for errors, and purple, cyan, pink, orange and yellow available for charts and highlights later.
- The light theme is unchanged. The System / Light / Dark control from spec 005 is unchanged.
- Small muted text needs a derived tone: Dracula's official "Comment" color `#6272A4` is only 3.03:1 on the background, below the 4.5:1 the app requires, so muted text uses a lighter blue-gray tone that keeps the Dracula feel and passes AA. This is the one intentional deviation from the official palette.
- Add `--surface` and `--border` tokens (both themes), and migrate `border-foreground/10-20` and `bg-foreground/5` to them so dark surfaces use the palette's `#44475A` instead of translucent overlays.
- `tests/theme.test.ts` keeps enforcing 4.5:1 for foreground, muted, danger and accent, now on both the background and the surface, in both themes.
- The README credits Dracula (draculatheme.com) for the palette.

### API
- `GET /api/expenses/[month]`: expenses active in the month with amount, category, paid with, note, added by (with `addedBy` name or "Former member"), category subtotals and month total.
- `POST /api/expenses` (`{ name, amountCents, intervalMonths, categoryId, paidWith?, note? }`, effective from the current month; `categoryId` is required; `intervalMonths` is one of 1, 3, 6, 12 and defaults to 1). Responses include `amountCents` (the bill), `intervalMonths` and `monthlyCents` (the monthly equivalent).
- `PATCH /api/expenses/[id]`: rename, paid-with, note, end or restore (label fields are not versioned).
- `PUT /api/expenses/[month]/items/[id]` (`{ amountCents, intervalMonths, categoryId }`): new amount, billing period and/or category from that month onward; rejects past months and inactive categories.
- `GET /api/budgets/[month]` gains, per category, `expensesCents` and `remainingCents`, and in the summary `expensesTotalCents` and `leftAfterExpensesCents`.
- `POST /api/budgets/[month]/assign-unallocated` (`{ categoryId }`): implements B; rejects past months, non-positive unallocated, and unknown or inactive categories.
- All routes use `requireHousehold()`; every member may call them.

## Out of scope
Actual transactions and per-charge logging (receipt capture and the transactions spec), paid-with as a managed list with balances or accounts, gross vs. net, tracking a bill's actual renewal date or a running "set aside so far" balance (that belongs with transactions), custom intervals other than monthly, 3, 6 and 12 months, variable-amount bills with a monthly estimate, splitting one expense across categories, automatic rollover of leftover money, importing from Notion or CSV, a user-chosen accent or palette, other themes.

## Acceptance criteria
- [ ] A member can add a monthly expense; the category field starts empty with a prompt and the expense cannot be saved without choosing one (UI) or a valid `categoryId` (API).
- [ ] The expense shows who added it; if that member is removed it shows "Former member" and still counts (covered by a test).
- [ ] An expense counts against its category in the month it starts and every later month with no further entry, and not in earlier months.
- [ ] Changing an expense's amount or category applies from the chosen month onward and leaves earlier months unchanged; past months reject edits (covered by tests, mocking the current month).
- [ ] Ending an expense stops it from this month onward; past months keep it.
- [ ] A category with active expenses cannot be archived (409 naming the count); after ending or moving them it can.
- [ ] Any household member can add, edit and end any expense; signed-out users and non-members are rejected on every route (covered by tests).
- [ ] The Expenses page shows the month's expenses grouped by category with subtotals and a total.
- [ ] The Budget page shows per-category expenses and remaining (negative flagged), plus Monthly expenses and Left after monthly expenses in the summary; `GET /api/budgets/[month]` returns the same numbers.
- [ ] Assign-to-category adds the unallocated amount to the chosen category from this month onward and brings unallocated to 0; it preselects "Savings" when present; it is unavailable for past months or when unallocated is 0; two concurrent assigns do not double-count (covered by tests).
- [ ] A yearly or 6-month expense counts its monthly equivalent (bill divided by the number of months, rounded to the nearest minor unit) in every active month, not only in a renewal month; the form previews it; totals and category rollups use it (covered by tests).
- [ ] Changing the billing period applies from the chosen month onward and leaves earlier months unchanged.
- [ ] Amounts are integer minor units; negative and fractional values are rejected; 0 is allowed for expenses.
- [ ] Dark theme uses the Dracula palette and the theme tests pass at 4.5:1 for foreground, muted, danger and accent on background and surface in both themes; light theme is unchanged.
- [ ] No hardcoded colors are introduced; borders and panels use the new `--border` and `--surface` tokens.
- [ ] Migration is additive and idempotent on restart; existing households simply have no expenses yet.
- [ ] Documentation updated (see Documentation).
- [ ] `npm run lint`, `npm test` and `npm run build` pass.

## Technical notes
- Tables (proposal): `monthly_expenses` (id uuid, household_id, name, paid_with text nullable, note text nullable, added_by text nullable fk user `on delete set null`, start_month date, archived_from date nullable, created_at) and `monthly_expense_versions` (id, expense_id, effective_month date, amount_cents integer check >= 0 (the bill), interval_months smallint check in (1, 3, 6, 12) default 1, category_id fk categories, created_by, created_at; unique on `(expense_id, effective_month)`). Amount, billing period and category share a version row so moving a bill between categories or changing how often it is billed never changes past months. The monthly equivalent is computed, not stored: `round(amount_cents / interval_months)` (half up) in one shared helper used by the SQL rollups and the API, with tests for amounts that do not divide evenly (a yearly total can differ from the bill by a few minor units, which is acceptable for a budget and is stated in the README).
- Effective version lookup and archive-by-month visibility (`start_month <= M < archived_from`) reuse the patterns from specs 004 and 006. Add a month-scoped query that returns each active expense with its effective amount and category, and reuse it for the Expenses page and the per-category rollup on the Budget page (`expensesCents` per category).
- Category archive check: before setting `archived_from`, count expenses whose effective category in the current month is that category and that are active; block when greater than 0. Also reject choosing an archived or not-yet-started category for a version.
- Assign-unallocated: in one transaction lock the category's allocation for the month (`select ... for update` on the latest allocation, or advisory lock on the household and month), recompute unallocated from income minus the sum of effective allocations, then upsert the allocation as the current effective amount plus unallocated. Reuse `setAllocation`'s rules (past months rejected, category visible in the month).
- Paid-with suggestions come from a distinct query over the household's expenses; no separate table.
- Dracula source: https://draculatheme.com/contribute lists Background `#282A36`, Selection `#44475A`, Foreground `#F8F8F2`, Comment `#6272A4`, Red `#FF5555`, Orange `#FFB86C`, Yellow `#F1FA8C`, Green `#50FA7B`, Cyan `#8BE9FD`, Purple `#BD93F9`, Pink `#FF79C6`. That page's table labels "Current Line" with the Comment color, which looks like a typo (the values `#44475A` and `#6272A4` are what matter here). It does not state a license; only these color values are used, with credit in the README.
- Contrast on `#282A36`: foreground 13.4:1, green 10.4:1, purple 5.9:1, red 4.5:1 (passes narrowly), Comment `#6272A4` 3.0:1 (fails). Check red on the surface tone (`#44475A`), where it is 2.9:1, and keep error text off surface panels or lighten it slightly; the theme test will catch this.
- Migrating `border-foreground/10-20` and `bg-foreground/5` to tokens touches most components; do it as a mechanical pass and re-run the theme tests.
- Tests that depend on "today" mock `currentMonth` as before; add `tests/expenses.test.ts` and reuse `tests/helpers.ts`.
- Read `node_modules/next/dist/docs/` before adding routes or pages. If the PR grows too large, it can land as three PRs in this order: C (theme), B (assign), A (expenses).

## Decisions
- **Unallocated is not defaulted to savings automatically.** Silent defaulting would show a Savings figure nobody chose, shift past months as income changes (breaking the history rule), and blur budget vs. actual. The explicit Assign button gives the same convenience without hiding anything.
- Recurring expenses are called **monthly expenses** in the UI, matching the owner's Notion doc, and count against a category as committed spend each month.
- Expenses are tagged with the member who added them, and any member can edit any expense.
- The category is chosen by the user, never defaulted.
- **Non-monthly bills are spread evenly.** Yearly, 6-month and 3-month bills count their monthly equivalent every month instead of hitting the renewal month. This smooths the budget like setting money aside for the renewal. The real charge and any set-aside balance are for the transactions spec.
- The Notion doc was reviewed read-only for shape (columns: Name, Amount, Type, Payment, Comment, and a monthly cash-flow rollup of income minus expenses). No real names or amounts from it are copied into the repo.

## Open questions
1. **Category with expenses when archiving:** proposal is to block archiving until the expenses are moved or ended. The alternative is to prompt to move them all to another category in one step. Recommendation: block for now, with a clear message.
2. **Paid-with:** keep it as optional free text with suggestions (proposed), or drop it until there are accounts to link it to?
3. **Left after monthly expenses:** should it be shown on the Budget page as proposed (income minus monthly expenses, like Notion's Spending/Saving), or only on the Expenses page?
4. **Assign preselect:** preselect the category named "Savings" (proposed), or always require choosing?
5. **Splitting the work:** land A, B and C as one PR (as the request framed it), or as three small PRs in the order C, B, A? Recommendation: three PRs, one spec.
6. **Intervals:** the fixed list of monthly, 3, 6 and 12 months (proposed), or any number of months from 1 to 36 with those four as presets? Recommendation: the fixed list for now.
7. **One-time import:** you have 20-odd existing items in Notion. Enter them by hand once (proposed), or is a CSV import worth its own small spec later?

## Documentation
- `README.md`: add Monthly expenses (recurring bills, including yearly and 6-month subscriptions spread evenly across months, counted against categories, added-by tag, time-versioned, past months read-only) and Assign unallocated to Features; note the Dracula palette credit and the dark theme change; update the status line.
- `CLAUDE.md`: architecture notes for the expense tables and the version lookup, the category-archive rule, the assign-unallocated transaction, and the new `--surface` and `--border` tokens (colors must come from tokens).
- `specs/README.md`: index entry.

## Verification
Fresh `docker compose up --build`: as the owner add three monthly expenses in different categories, confirm the category field starts empty and cannot be skipped, and that each shows its adder. As a second member edit one; confirm both members can. Set budgets and confirm each category's Budgeted, Monthly expenses and Remaining, and the Left after monthly expenses line. Change an expense's amount and category for next month and confirm this month is unchanged. End an expense and confirm past months keep it. Try archiving a category that has expenses and confirm it is blocked. With income exceeding the budget, use Assign to Savings and confirm unallocated goes to 0 and Savings increased. Remove the member who added an expense and confirm "Former member". Check every page in light and dark; dark should look like Dracula. Run tests, lint and build.
