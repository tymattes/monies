# 007: Bills, assign-to-savings, and a Dracula dark theme

**Status:** implemented

## Goal
Three related improvements before receipt capture, all about making the monthly budget more useful and the app nicer to live in:

- **A. Bills.** The household records its recurring bills once (rent, subscriptions, phone, utilities, insurance), each tagged with who added it and a category the user is prompted to choose. Every month those bills count against their category automatically, without logging each one. This brings over the "Monthly Expenses" idea from the owner's Notion Finances doc: a list of recurring items with a type, an amount, a payment method and a comment, rolled up against income into what is left to spend or save (Notion's "Monthly Cash Flow").
- **B. Assign unallocated to a category.** A one-click way to put the month's leftover (unallocated) budget into Savings or any other category, instead of defaulting it silently. See the discussion in the Decisions section.
- **C. Dracula themes.** Replace the dark palette with the widely used Dracula palette, and the light palette with Alucard, Dracula's official light variant, so the two themes are a matched pair.

Supports `brief.md`: category-driven budgets, modern UX, and a path to budget vs. actual (recurring bills are the first source of "actual").

## Requirements

### A. Bills
- A **bill** is a recurring cost of the household (rent, a phone plan, a streaming subscription, yearly insurance) that counts against the budget every month. It has: a name, the **amount charged** and **how often it is billed**, a **category** (required), an optional **paid with** label (free text, e.g. "Checking", "Amazon card"), an optional note, and **added by** (the member who created it).
- **The category is required and the user is prompted to choose it** when creating a bill: the field starts empty with a "Choose a category" prompt, so nothing is assigned by default. Only active categories are offered.
- **Time-versioned like budgets and income.** The amount, billing period and category are versioned together, effective from a month onward: a month's values are the latest version on or before it. Changing an amount or billing period, or moving a bill to another category, applies from a chosen month forward, never rewriting past months. Only the current and future months can be changed.
- **Billing period.** A bill can be billed **monthly, every 3 months, every 6 months, or yearly**. The user enters the real charge (e.g. 120.00 every 12 months) and never the monthly figure. The form shows a live preview ("= 10.00 / month"). The **monthly equivalent** is the amount charged divided by the number of months, rounded to the nearest minor unit, and that is what counts against the category in every month the bill is active. So a yearly subscription is spread evenly across the whole year instead of landing in its renewal month.
- **Every month the bill counts against its category** for each month it is active, with no per-month entry. The amount may be 0 (a placeholder or a paused bill). Amounts shown in lists include both the charge and its monthly equivalent (e.g. "120.00 / year, about 10.00 / month"); all totals and category rollups use monthly equivalents.
- Bills can be renamed, have their paid-with label and note edited, and be **ended** (archived from a month onward; history stays). Ending a bill is how a cancelled subscription stops counting.
- **Added by** is shown on each bill. If that member is later removed, it shows "Former member" and the bill stays (same behavior as income).
- **Who can edit:** every household member can add, edit and end any bill (household bills are shared). The added-by tag is informational, not a permission.
- A category with active bills cannot be archived until they are moved or ended; the error names how many bills block it.
- **Bills page.** One month at a time (previous/next), listing that month's bills with amount, category, paid with, note and added by, grouped by category with subtotals and a month total. A form adds a bill (name, amount, category prompt, paid with, note). Paid-with offers the household's previously used labels as suggestions.
- **Budget page integration.** Each category row gains what is committed and what remains: **Budgeted**, **Bills**, **Remaining** (budgeted minus bills; negative is flagged in the error color as over). The page summary adds **Bills** total and **Left after bills** (income minus bills), which mirrors the Notion "Spending/Saving" figure. The existing income and unallocated lines stay.

### B. Assign unallocated
- When the month's unallocated amount is greater than 0 and the month is editable, the Budget page shows an **Assign** panel under the Unallocated line. The user can spread the amount across **one or more categories in a single click**.
- The panel is a list of rows, each a category and an amount. The first row starts on the category named "Savings" (case-insensitive) if one exists, otherwise on a "Choose a category" prompt, with the whole unallocated amount. **Add category** adds a row (prefilled with what is still unassigned), **Remove** drops a row, and **Split evenly** divides the unallocated amount equally across the rows (extra cents go to the first rows). A category can appear only once.
- A live line shows what is being assigned and what stays unallocated, and turns to an error if the amounts add up to more than the unallocated amount. The **Assign** button is enabled only when every row has a category and a positive amount and the total is between 0 and the unallocated amount. Assigning less than the whole amount is allowed; the rest stays unallocated.
- Assigning adds each amount to that category's current amount for this month, from this month onward (the same effect as typing each total in), and the unallocated line drops by the assigned total.
- The amounts are ordinary allocations afterwards: editable, and they appear in history like any other. Nothing is assigned automatically.
- All the assignments apply in **one database transaction** under a per-household-and-month lock: either every row is applied or none is, and two clicks or two members cannot assign the same money twice.

### C. Dracula dark theme and Alucard light theme
- The dark theme uses the official Dracula palette (source under Technical notes): background `#282A36`, foreground `#F8F8F2`, surfaces and borders `#44475A`, with green `#50FA7B` as the accent, red `#FF5555` for errors, and purple, cyan, pink, orange and yellow available for charts and highlights later.
- The light theme is **Alucard Classic**, Dracula's official light variant: warm cream background `#FFFBEB`, foreground `#1F1F1F`, comment `#6C664B` for muted text, red `#CB3A2A`, green `#14710A` as the accent. Its surface and border tones are derived from the cream background. The System / Light / Dark control from spec 005 is unchanged.
- Browser autofill styling (the yellow or blue fill Chrome and Safari paint on autofilled inputs) is overridden so autofilled fields stay on theme in both modes.
- Small muted text needs a derived tone: Dracula's official "Comment" color `#6272A4` is only 3.03:1 on the background, below the 4.5:1 the app requires, so muted text uses a lighter blue-gray tone that keeps the Dracula feel and passes AA. This is the one intentional deviation from the official palette.
- Add `--surface` and `--border` tokens (both themes), and migrate `border-foreground/10-20` and `bg-foreground/5` to them so dark surfaces use the palette's `#44475A` instead of translucent overlays.
- `tests/theme.test.ts` keeps enforcing 4.5:1 for foreground, muted, danger and accent on the background, and for foreground, muted and accent on the surface, in both themes. **Danger is not checked on the surface:** Dracula red `#FF5555` is 4.5:1 on the background but 2.9:1 on `#44475A`, and no red close to Dracula's passes there, so the rule is that error text never sits on a surface panel (documented in `globals.css` and CLAUDE.md). The test also guards against hardcoded colors and translucent foreground overlays in `src/`.
- The README credits Dracula and Alucard (draculatheme.com) for the palettes.

### API
- `GET /api/bills/[month]`: bills active in the month with amount, category, paid with, note, added by (with `addedBy` name or "Former member"), category subtotals and month total.
- `POST /api/bills` (`{ name, amountCents, intervalMonths, categoryId, paidWith?, note? }`, effective from the current month; `categoryId` is required; `intervalMonths` is one of 1, 3, 6, 12 and defaults to 1). Responses include `amountCents` (the charge per billing period), `intervalMonths` and `monthlyCents` (the monthly equivalent).
- `PATCH /api/bills/items/[id]`: rename, paid-with, note, end or restore (label fields are not versioned). The `items/` segment avoids a route clash with `[month]`.
- `PUT /api/bills/[month]/items/[id]` (`{ amountCents, intervalMonths, categoryId }`): new amount, billing period and/or category from that month onward; rejects past months and inactive categories.
- `GET /api/budgets/[month]` gains, per category, `billsCents` and `remainingCents`, and in the summary `billsTotalCents` and `leftAfterBillsCents`.
- `POST /api/budgets/[month]/assign-unallocated` implements B. Body: `{ assignments: [{ categoryId, amountCents }, ...] }` (1 to 50 items, amounts positive integers, categories distinct, total at most the unallocated amount), or the shorthand `{ categoryId }` meaning all of it into one category. Returns `{ assignments: [{ categoryId, assignedCents, amountCents }], assignedCents, unallocatedCents }` (the last is what remains). Rejects past months, a month with nothing unallocated, unknown or inactive categories, duplicates, and totals over the unallocated amount, all-or-nothing.
- All routes use `requireHousehold()`; every member may call them.

## Out of scope
Actual transactions and per-charge logging (receipt capture and the transactions spec), paid-with as a managed list with balances or accounts, gross vs. net, tracking a bill's actual renewal date or a running "set aside so far" balance (that belongs with transactions), custom intervals other than monthly, 3, 6 and 12 months, variable-amount bills with a monthly estimate, splitting one bill across categories, automatic rollover of leftover money, importing from Notion or CSV, a user-chosen accent or palette, other themes.

## Acceptance criteria
- [x] A member can add a bill; the category field starts empty with a prompt and the bill cannot be saved without choosing one (UI) or a valid `categoryId` (API).
- [x] The bill shows who added it; if that member is removed it shows "Former member" and still counts (covered by a test).
- [x] A bill counts against its category in the month it starts and every later month with no further entry, and not in earlier months.
- [x] Changing a bill's amount or category applies from the chosen month onward and leaves earlier months unchanged; past months reject edits (covered by tests, mocking the current month).
- [x] Ending a bill stops it from this month onward; past months keep it.
- [x] A category with active bills cannot be archived (409 naming the count); after ending or moving them it can.
- [x] Any household member can add, edit and end any bill; signed-out users and non-members are rejected on every route (covered by tests).
- [x] The Bills page shows the month's bills grouped by category with subtotals and a total.
- [x] The Budget page shows per-category bills and remaining (negative flagged), plus Bills and Left after bills in the summary; `GET /api/budgets/[month]` returns the same numbers.
- [x] Assign can spread the unallocated amount across one or more categories in a single click: each amount is added to its category from this month onward and unallocated drops by the total; the first row preselects "Savings" when present; assigning less than the whole amount leaves the rest unallocated; amounts over the unallocated total, duplicate categories, and any invalid row are rejected with nothing applied; it is unavailable for past months or when unallocated is 0; concurrent assigns never double-count (covered by tests).
- [x] A yearly or 6-month bill counts its monthly equivalent (the charge divided by the number of months, rounded to the nearest minor unit) in every active month, not only in a renewal month; the form previews it; totals and category rollups use it (covered by tests).
- [x] Changing the billing period applies from the chosen month onward and leaves earlier months unchanged.
- [x] Amounts are integer minor units; negative and fractional values are rejected; 0 is allowed for bills.
- [x] Dark theme uses the Dracula palette and light theme uses Alucard; the theme tests pass at 4.5:1 for foreground, muted, danger and accent on the background, and foreground, muted and accent on the surface, in both themes, and input borders are at least 3:1 against the background.
- [x] Autofilled inputs use the theme colors instead of the browser's yellow or blue fill.
- [x] No hardcoded colors are introduced; borders and panels use the new `--border` and `--surface` tokens.
- [x] Migration is additive and idempotent on restart; existing households simply have no bills yet.
- [x] Documentation updated (see Documentation).
- [x] `npm run lint`, `npm test` and `npm run build` pass.

## Technical notes
- Tables (proposal): `bills` (id uuid, household_id, name, paid_with text nullable, note text nullable, added_by text nullable fk user `on delete set null`, start_month date, archived_from date nullable, created_at) and `bill_versions` (id, bill_id, effective_month date, amount_cents integer check >= 0 (the charge per billing period), interval_months smallint check in (1, 3, 6, 12) default 1, category_id fk categories, created_by, created_at; unique on `(bill_id, effective_month)`). Amount, billing period and category share a version row so moving a bill between categories or changing how often it is billed never changes past months. The monthly equivalent is computed, not stored: `round(amount_cents / interval_months)` (half up) in one shared helper used by the SQL rollups and the API, with tests for amounts that do not divide evenly (a yearly total can differ from the real charge by a few minor units, which is acceptable for a budget and is stated in the README).
- Effective version lookup and archive-by-month visibility (`start_month <= M < archived_from`) reuse the patterns from specs 004 and 006. Add a month-scoped query that returns each active bill with its effective amount and category, and reuse it for the Bills page and the per-category rollup on the Budget page (`billsCents` per category).
- Category archive check: before setting `archived_from`, count bills whose effective category in the current month is that category and that are active; block when greater than 0. Also reject choosing an archived or not-yet-started category for a version.
- Assign-unallocated: in one transaction lock the category's allocation for the month (`select ... for update` on the latest allocation, or advisory lock on the household and month), recompute unallocated from income minus the sum of effective allocations, then upsert the allocation as the current effective amount plus unallocated. Reuse `setAllocation`'s rules (past months rejected, category visible in the month).
- Paid-with suggestions come from a distinct query over the household's bills; no separate table.
- Dracula source: https://draculatheme.com/contribute (dark) and https://draculatheme.com/spec (Alucard Classic light: Background `#FFFBEB`, Foreground `#1F1F1F`, Comment `#6C664B`, Selection `#CFCFDE`, Red `#CB3A2A`, Orange `#A34D14`, Yellow `#846E15`, Green `#14710A`, Cyan `#036A96`, Purple `#644AC9`, Pink `#A3144D`). The contribute page lists Background `#282A36`, Selection `#44475A`, Foreground `#F8F8F2`, Comment `#6272A4`, Red `#FF5555`, Orange `#FFB86C`, Yellow `#F1FA8C`, Green `#50FA7B`, Cyan `#8BE9FD`, Purple `#BD93F9`, Pink `#FF79C6`. That page's table labels "Current Line" with the Comment color, which looks like a typo (the values `#44475A` and `#6272A4` are what matter here). It does not state a license; only these color values are used, with credit in the README.
- Contrast on `#282A36`: foreground 13.4:1, green 10.4:1, purple 5.9:1, red 4.5:1 (passes narrowly), Comment `#6272A4` 3.0:1 (fails). Check red on the surface tone (`#44475A`), where it is 2.9:1, and keep error text off surface panels or lighten it slightly; the theme test will catch this.
- Migrating `border-foreground/10-20` and `bg-foreground/5` to tokens touches most components; do it as a mechanical pass and re-run the theme tests.
- Tests that depend on "today" mock `currentMonth` as before; add `tests/bills.test.ts` and reuse `tests/helpers.ts`.
- Read `node_modules/next/dist/docs/` before adding routes or pages. If the PR grows too large, it can land as three PRs in this order: C (theme), B (assign), A (bills).

## Decisions
- **Unallocated is not defaulted to savings automatically.** Silent defaulting would show a Savings figure nobody chose, shift past months as income changes (breaking the history rule), and blur budget vs. actual. The explicit Assign button gives the same convenience without hiding anything.
- **Naming: "Bills".** "Monthly" is wrong once yearly and 6-month items exist, and plain "Expenses" would collide with the receipts and transactions specs, where each purchase is also an expense. "Bills" stays distinct, is short for the nav, and fits rent, utilities, subscriptions and insurance. Bills count against a category as committed spend each month; the Budget columns read Budgeted / Bills / Remaining, with a "Left after bills" line.
- Bills are tagged with the member who added them, and any member can edit any bill.
- The category is chosen by the user, never defaulted.
- **Non-monthly bills are spread evenly.** Yearly, 6-month and 3-month bills count their monthly equivalent every month instead of hitting the renewal month. This smooths the budget like setting money aside for the renewal. The real charge and any set-aside balance are for the transactions spec.
- The Notion doc was reviewed read-only for shape (columns: Name, Amount, Type, Payment, Comment, and a monthly cash-flow rollup of income minus expenses). No real names or amounts from it are copied into the repo.

- Archiving a category that has active bills is blocked until they are moved or ended, with a clear message naming the count.
- "Paid with" is optional free text with suggestions from what the household has already used.
- "Left after bills" (income minus bills) is shown on the Budget page.
- Assign-to-category preselects the category named "Savings" when present.
- Work lands as three PRs under this one spec, in the order C (theme), B (assign), A (bills).
- Billing periods are the fixed set of monthly, 3, 6 and 12 months; custom intervals can come later.
- The owner's existing items are entered by hand once; a CSV import would be its own spec if ever needed.

## Documentation
- `README.md`: add Bills (recurring bills, including yearly and 6-month subscriptions spread evenly across months, counted against categories, added-by tag, time-versioned, past months read-only) and Assign unallocated to Features; note the Dracula palette credit and the dark theme change; update the status line.
- `CLAUDE.md`: architecture notes for the bill tables and the version lookup, the category-archive rule, the assign-unallocated transaction, and the new `--surface` and `--border` tokens (colors must come from tokens).
- `specs/README.md`: index entry.

## Verification
Fresh `docker compose up --build`: as the owner add three bills in different categories, confirm the category field starts empty and cannot be skipped, and that each shows its adder. As a second member edit one; confirm both members can. Set budgets and confirm each category's Budgeted, Bills and Remaining, and the Left after bills line. Change a bill's amount and category for next month and confirm this month is unchanged. End a bill and confirm past months keep it. Try archiving a category that has bills and confirm it is blocked. With income exceeding the budget, use Assign to Savings and confirm unallocated goes to 0 and Savings increased. Remove the member who added a bill and confirm "Former member". Check every page in light and dark; dark should look like Dracula. Run tests, lint and build.

## Implementation notes

### Part C (Dracula theme), first PR
- Tokens added: `--surface`, `--border`, `--border-strong`. Light values are Alucard with derived surfaces: background `#FFFBEB`, foreground `#1F1F1F`, muted `#6C664B` (5.6:1), danger `#CB3A2A` (4.9:1), accent `#14710A` (6.0:1), surface `#EFE9CF`, border `#DDD6B8`, and input/button border `#8A8467` (3.6:1 on the background). Dark values are Dracula: surface and dividers `#44475A`, input and button borders `#6272A4` (3.03:1 on the background, which keeps input boundaries visible).
- Dark `--muted` is `#B4BBDB` (7.5:1 on the background, 4.8:1 on the surface), the deliberate deviation from Dracula's comment color. Dark `--danger` is the official `#FF5555`.
- Every `border-foreground/10-20`, `divide-foreground/10` and `bg-foreground/5` in `src/` was migrated to `border-border`, `border-border-strong`, `divide-border` and `bg-surface`. `tests/theme.test.ts` now fails if a translucent foreground overlay, a Tailwind palette color, or a literal hex color reappears in `src/`.
- The input focus border now uses `--accent` in both themes (it was a 50% foreground overlay), which also makes keyboard focus easier to see.
- Autofill: `globals.css` overrides `:-webkit-autofill` and `:autofill` (text color and an inset shadow in `--background`) because Chrome painted an olive fill on the sign-in email field in dark mode.
- The logo and accent text pick up Dracula green in dark mode through `--accent`.

- Brand and icons (owner-approved during review): the overall scheme is purple / cream / green, recorded in CLAUDE.md. The favicon is now the M logo: `src/app/icon.svg` switches colors with the browser's light or dark mode (deep green tile and cream M, or bright green tile and dark M), and `favicon.ico` (16, 32, 48 px) and `apple-icon.png` (180 px, full-bleed since iOS rounds its own corners) use the bright green tile with the dark M so they read on any tab strip or home screen. Raster icons were rendered from the same M path with `sharp`.

### Part A (bills), third PR
- Tables `bills` and `bill_versions` (migration `0004_bills`): amount, `interval_months` (check in 1, 3, 6, 12) and category share a version row; `bills.added_by` is `on delete set null` so a removed adder shows as "Former member" and the bill keeps counting.
- The monthly equivalent is `round(charge / interval)` half up, implemented twice on purpose and tested together: `monthlyEquivalent` in `src/lib/bills.ts` and the SQL in the month query (`(amount::bigint + interval / 2) / interval`). `tests/bills.test.ts` checks that they agree for uneven amounts (1999 over 12 months is 167, 100 over 6 is 17, 3 over 6 is 1).
- Routes: `POST /api/bills`, `GET /api/bills/[month]`, `PATCH /api/bills/items/[id]`, `PUT /api/bills/[month]/items/[id]`. Any household member may call them; there is no owner check by design.
- Archiving a category is blocked (409, naming how many bills) while a bill's current version uses it or a scheduled future version moves a bill into it (`countBillsBlockingCategory`).
- `GET /api/budgets/[month]` now returns per category `billsCents` and `remainingCents` (budgeted minus bills) and, in the summary, `billsTotalCents` and `leftAfterBillsCents` (income minus bills).
- Budget page: each category row shows Bills and Left beside its Budgeted input (Left turns to the error color when negative); the summary gains Monthly bills and Left after bills (or "Bills exceed income by"). On phones the two extra numbers drop to a line under the category name.
- Bills page (`/bills`): month navigation, the month's total, an add form whose category field starts empty ("Choose a category") and cannot be skipped, a live "= X / month" preview for non-monthly bills, paid-with suggestions from a datalist, and bills grouped by category with subtotals. Each bill can be edited (amount, period and category apply from the viewed month onward) or ended. Past months are read-only.
- The bill's own category may have been archived since; the edit form keeps it selectable so the bill can still be saved or moved.
- Not built: bill categories are chosen from active categories only when adding; editing a bill in a future month offers today's active categories rather than ones active in that specific month (the API still validates the month).
- Tests: `tests/bills.test.ts` (34 tests) covering creation and validation, the required category, time-versioning, read-only past months, ending and restoring, adder tagging and removed members, grouping, the archive block (including future versions), the Budget integration, and access control.

### Part B (assign unallocated), second PR
- `POST /api/budgets/[month]/assign-unallocated` takes `{ assignments: [...] }` (or the `{ categoryId }` shorthand) and returns the per-category results plus what remains unallocated. It rejects past months, unknown, archived or malformed categories, and any month with nothing unallocated (zero or over-allocated).
- The lock is `pg_advisory_xact_lock(hashtextextended('<household>:<month>', 0))` inside the transaction; the budget is read after the lock is taken so an earlier assign is already committed. `setAllocation` does not take the lock, so a manual edit racing an assign can interleave, which is acceptable for two people editing the same month at once.
- UI: the Assign panel appears under the Unallocated line only when the month is editable and the amount is greater than 0. It resets whenever the unallocated amount changes (its `key`), so it never shows stale amounts after an edit above it. Category selects hide categories already chosen in other rows.
- `BudgetEditor` is now keyed on the server data (month, income, categories and amounts), so it remounts after an assign and also after a category is added or renamed, which previously left a new category's input blank until a full reload.
- Tests: `tests/assign.test.ts` (17 tests) including simultaneous requests yielding exactly one success for both the single and split forms, and atomicity (an invalid row or an over-total applies nothing); verified by temporarily removing the lock, which made all four simultaneous requests succeed.

## Not verified (Part A)
The Bills page and the new Budget columns were not clicked through in a browser (adding and editing a bill, the live preview, the category prompt, the column layout on a phone). The routes, calculations and page rendering were verified by tests and against a scratch instance with two members.

## Not verified (Part B)
The Assign panel was not clicked through in a browser (row editing, Split evenly, button enabling, the refresh after assigning). The route, the lock and the page rendering (control present before, gone after) were checked by tests and against a scratch instance.

## Not verified (Part C)
The dark theme was not looked at in a real browser; it was verified by contrast tests, by confirming Tailwind generates every new utility, and by lint, typecheck and build. Please check each page in dark mode. The spec stays `approved` until parts B and A land.
