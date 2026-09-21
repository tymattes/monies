# 008: Overview page and a grouped Plan area

**Status:** approved

## Goal
Separate the places you **edit** the monthly plan from the place you **read** how the month is going, and tie the three inputs (Budget, Bills, Income) together so they read as one plan. Add an **Overview** home page for the results, and group Budget, Bills and Income under a **Plan** area with a shared month switcher and a persistent summary bar. This also gives future transactions a natural home: "Spent" and "Left" will slot into the Overview instead of crowding the Budget table.

Supports `brief.md`: dashboards (budget vs. actual, income vs. spend, household-level views), modern and mobile-first UX. This spec builds the dashboard as far as the data allows today (income, bills, budgets); actual spend and multi-month trends follow with transactions.

## Research
Sources consulted (the brief's UX-trends research task, partly covered here: navigation and data visualization; motion and dark-mode trends are not covered):
- **Navigation size.** Material Design's bottom navigation and navigation bar guidance is three to five top-level destinations of equal importance, with tabs for content that shares a subject ([Material Design 3 navigation bar](https://m3.material.io/components/navigation-bar/guidelines), [Material 2 bottom navigation](https://m2.material.io/components/bottom-navigation)). Apple's guidance is likewise three to five tabs and the minimum needed ([Human Interface Guidelines: Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)). Budget, Bills and Income share one subject (the month's plan), so they fit as sub-tabs under one destination, which keeps the top level short as Transactions and Trends arrive.
- **Unassigned money at the top of the plan.** YNAB shows a "Ready to Assign" banner at the top of its Plan tab with an "Assign Money" button, and hides it once everything is assigned ([The Plan Header in YNAB](https://support.ynab.com/en_us/the-plan-header-BkmiuJ_C9)). That is the model for a persistent unallocated bar with an Assign action.
- **Dashboard layout.** Show the few most important numbers first and reveal detail on demand ([NN/g on progressive disclosure](https://www.nngroup.com/videos/progressive-disclosure/)). A secondary source suggests key numbers on top, context in the middle, and detailed tables below, with three to five headline numbers ([Aufait UX dashboard principles](https://www.aufaitux.com/blog/dashboard-design-principles/)); treat that as guidance, not a rule.
- **Charts.** Stephen Few recommends against pie charts because people judge angles and areas poorly ([Save the Pies for Dessert](https://www.perceptualedge.com/articles/visual_business_intelligence/save_the_pies_for_dessert.pdf)) and designed the bullet graph, a compact bar with a target marker, for comparing an actual to a plan ([Tableau: what is a bullet graph](https://www.tableau.com/chart/what-is-bullet-graph)). Budget vs. bills per category is exactly that comparison.
- **Adopt:** short top-level nav, a persistent unallocated bar with an action, linear bars over pies, big numbers first. **Avoid:** gauges and pies, dense tables as the home page, more than five top-level destinations.

## Requirements

### Navigation
- Top-level destinations become **Overview**, **Plan** and **Members** (plus the theme switch and sign out), down from Budget, Bills, Income and Members. Transactions and Trends are added later, staying within five.
- **Overview** is the home page (`/`), replacing today's near-empty greeting.
- **Plan** groups **Budget | Bills | Income** as sub-tabs. The header's Plan item opens Budget and is highlighted on any of the three, and the sub-tabs show the current one with `aria-current`.
- Existing URLs stay: `/budget`, `/bills`, `/income`, and the `?month=YYYY-MM` parameter. Nothing about the API routes changes.
- The three Plan pages share one **Plan header**: page title, the sub-tabs, the month switcher, and the summary bar below. Because layouts cannot read `searchParams` in Next.js, this is a shared component each page renders, not a layout.

### Plan summary bar (on Budget, Bills and Income)
- For the selected month: **Income**, **Budgeted** (with "of which bills" beside it), and **Unallocated**, each a label and a value. When budgeted exceeds income it reads **Over-allocated by X** in the error color instead.
- On the Budget page it updates live as amounts are edited (it shares state with the editor); on Bills and Income it reflects the saved data.
- When the month is editable and Unallocated is greater than 0, an **Assign** button appears. On Budget it scrolls to and focuses the existing Assign panel; from Bills or Income it navigates to `/budget?month=…#assign`. The Assign panel itself stays on the Budget page (assigning is an edit).
- The summary rows that Budget shows today (Total budgeted, Monthly bills, Income, Left after bills, Unallocated) move into this bar and out of the table footer, except **Left after bills**, which moves to the Overview.

### Overview page (household level, one month at a time)
- Month switcher, defaulting to the current month, and the same past-month read-only behavior as the Plan pages.
- **Cash flow** card: the month's income and one horizontal stacked bar splitting it into **Bills** (bills within each category's budget), **Rest of budget**, and **Unallocated**, with a legend showing amounts. Over-allocated shows the bar full plus an "over by X" marker. Unallocated uses the same definition everywhere (income minus budgeted), so it always matches the Plan summary bar.
- **Categories** table: Category, Budgeted, Bills, Left, with a bullet-style bar per row (fill = bills as a share of the budget, a marker at the budget, danger color when bills exceed it). A **Spent** column is reserved for the transactions spec and is not shown until then.
- **Income** card: total, fixed vs. variable, and by member, linking to the Income page.
- **Bills** card: monthly total (yearly and 6-month bills shown as their monthly equivalents), by category, and the largest few bills, linking to the Bills page.
- **Needs attention** list, shown only when there is something to say, each item with a link to fix it: unallocated money (with Assign), over-allocated, a category whose bills exceed its budget (names the category and the amount), bills exceeding income, and setup gaps (no income yet, no bills yet).
- No pie or gauge charts. Charts are plain SVG or CSS rendered on the server, with no chart library. Every graphic has a text equivalent (`role="img"` with a label, or an adjacent table), and color is never the only signal.
- Empty states for a new household explain what to add first and link to it.

### Chart colors
- Add `--chart-1` to `--chart-4` tokens for both themes, taken from the Dracula (dark) and Alucard (light) secondary palettes (purple, cyan, pink, orange), each at least 3:1 against the background (non-text contrast) and distinguishable from one another. Semantic states keep using `--danger` and `--accent`.

### API
- `GET /api/overview/[month]` returns everything the page shows, so a future iOS app gets the same numbers: income (total, fixed, variable, by member), bills (total, by category, largest), budget (budgeted total, unallocated), cash-flow segments, the category rows (budgeted, bills, left), and the attention items (`code`, `message`, `href`, and amounts). It composes the existing budget, income and bills queries and adds no new tables.
- The page and the API read the same function so the numbers cannot drift apart.

## Out of scope
Transactions and actual spend, the Trends page (multi-month charts) and any history charts, per-member views beyond income by member (bill "added by" means who entered it, not whose bill it is, so a per-member bills view would mislead until a "for whom" field exists), a bottom tab bar or other mobile navigation change (revisit when there are four or five top-level destinations), a chart library, goals, forecasts, notifications, exports, and renaming URLs or API routes.

## Acceptance criteria
- [x] The header shows Overview, Plan and Members; Plan opens Budget and is highlighted on Budget, Bills and Income; Budget | Bills | Income sub-tabs mark the current page.
- [ ] `/` is the Overview and renders for a new household (empty states) and a fully set-up one.
- [x] `/budget`, `/bills` and `/income` keep working at the same URLs with the same `?month=` behavior.
- [x] The summary bar appears on all three Plan pages with Income, Budgeted (and bills within it) and Unallocated / Over-allocated.
- [x] On Budget the summary bar updates live as an amount is edited; on Bills and Income it matches the saved data.
- [x] Assign appears in the bar only when the month is editable and Unallocated is greater than 0, and takes the user to the Assign panel (scrolling and focusing it on Budget).
- [ ] The Overview cash-flow bar's segments add up to the month's income (or show over-allocation), and its Unallocated equals the summary bar's.
- [ ] The Overview category table matches `GET /api/budgets/[month]` for budgeted, bills and left.
- [ ] Attention items appear only when relevant and each links to where it is fixed (covered by tests for each item).
- [ ] `GET /api/overview/[month]` returns the same numbers as the page and rejects signed-out users and non-members (covered by tests).
- [ ] No pie or gauge charts; every graphic has a text equivalent; nothing relies on color alone.
- [ ] Chart tokens pass the theme test (3:1 against the background, distinct) in both themes, and no hardcoded colors are introduced.
- [ ] Past months are read-only everywhere and the Overview shows them without an Assign action.
- [ ] Documentation updated (see Documentation).
- [ ] `npm run lint`, `npm test` and `npm run build` pass.

## Technical notes
- Move page code into shared components: `PlanHeader` (title, `PlanTabs`, `MonthNav`, summary bar) used by the three Plan pages, and a presentational `PlanSummary` that Budget renders from live client state and Bills and Income render from server data. `BudgetEditor` already holds the live totals; lift the summary into it on the Budget page.
- One server function `getOverview(ctx, month)` in `src/lib/overview.ts` composes `getBudget`, `getIncomeMonth` and `getBillsMonth`; the API route and the Overview page both call it. Cash-flow segments: `billsWithinBudget = Σ min(bills, budgeted)`, `restOfBudget = Σ max(budgeted − bills, 0)`, `unallocated = income − budgeted`; the bar is scaled to `max(income, budgeted)`. Bills that exceed a category's budget are flagged as an attention item rather than changing the Unallocated definition.
- Attention codes (proposal): `unallocated`, `over_allocated`, `category_bills_over_budget`, `bills_exceed_income`, `no_income`, `no_bills`.
- Sub-tab and header active states use `usePathname` in small client components; the rest stay server components.
- The Assign panel gets `id="assign"` and focuses on mount when the URL hash is `#assign`. It currently only renders when Unallocated is greater than 0, so the bar's Assign button is hidden otherwise.
- Chart tokens: pick from the palettes documented in `globals.css` (Dracula purple `#BD93F9`, cyan `#8BE9FD`, pink `#FF79C6`, orange `#FFB86C` in dark; Alucard purple `#644AC9`, cyan `#036A96`, pink `#A3144D`, orange `#A34D14` in light). Extend `tests/theme.test.ts` for the new tokens (same set in both themes, 3:1 against the background, pairwise different).
- Tests: `tests/overview.test.ts` for the composed numbers, each attention item, empty households, read-only past months and access control (mock `currentMonth` as before). Existing page-level behavior is covered by the API tests; add a check that the segments always sum correctly.
- Read `node_modules/next/dist/docs/` before changing pages or navigation; layouts do not receive `searchParams` (confirmed in the layout docs).
- Land as two PRs if large: (1) Plan grouping, the shared header and summary bar; (2) the Overview page, its API and the chart tokens.

## Decisions
- The results page is named **Overview** and is the home page; "Performance" wording is reserved for a section inside it ("Budget vs. actual") once transactions exist.
- Budget, Bills and Income group under **Plan** with a shared month switcher and a persistent summary bar; the Assign panel stays on Budget.

- The header's Plan item opens Budget by default.
- Existing URLs stay (`/budget`, `/bills`, `/income`), not `/plan/...`, so bookmarks and the page and API names stay aligned.
- Charts are hand-built SVG and CSS with no chart library; a library can be reconsidered for the Trends page.
- From the Overview, Assign links to the Budget page's Assign panel rather than opening inline.
- The attention list is the proposed set: unallocated, over-allocated, a category whose bills exceed its budget, bills exceeding income, no income yet, no bills yet.
- Trends is its own later spec, since it needs more than one month of history.
- Work lands as two PRs under this one spec: (1) the Plan grouping, shared header and summary bar; (2) the Overview page, its API and the chart tokens. The spec stays `approved` until both land.

## Documentation
- `README.md`: describe Overview and the Plan area in Features (what each shows, the summary bar and Assign), and update the status line.
- `CLAUDE.md`: navigation structure (Overview, Plan with Budget | Bills | Income, Members), that layouts cannot read `searchParams` so `PlanHeader` is a component, the Unallocated definition (income minus budgeted, used everywhere), the chart tokens, and the rule of no pie or gauge charts.
- `specs/README.md`: index entry.

## Verification
Fresh `docker compose up --build`: sign in and confirm the header shows Overview, Plan, Members, and that Plan lights up on Budget, Bills and Income. On each Plan page confirm the summary bar matches; edit a Budget amount and watch Unallocated change live; use Assign from the bar on Bills and confirm it lands on the Budget Assign panel. Open the Overview and confirm the cash-flow bar adds up, the category table matches Budget, and the attention list names a category whose bills exceed its budget. Check a past month (read-only, no Assign) and an empty household. Check everything in light and dark, and on a phone-width window.

## Implementation notes

### PR 1 of 2: Plan grouping, shared header and summary bar
- New components: `HeaderNav` (client, `usePathname`; Overview, Plan, Members with `aria-current`), `PlanTabs` (client; Budget | Bills | Income, keeps `?month=` only when it is not the current month), `PlanHeader` (server; title with a "Plan" label, tabs, `MonthNav`, and the summary when given one), and `PlanSummary` (client; Income, Budgeted with "of which bills", and Unallocated or Over-allocated by). The Assign button is a `scroll` button on the Budget page and a link to `/budget?month=…#assign` elsewhere.
- `getPlanSummary` (`src/lib/plan.ts`) feeds the Bills and Income pages from one `getBudget` call, so its numbers equal the Budget API's (a test compares them). On the Budget page `BudgetEditor` renders the summary itself from its live state, so it changes as amounts are edited.
- The Budget table's old footer rows (Total budgeted, Monthly bills, Household income, Left after bills, Unallocated) are gone. The table ends with a **Total** row aligned to its columns (bills, left, budgeted), followed by the Assign panel. "Left after bills" is not shown anywhere until the Overview page (PR 2) gives it a home.
- The Assign panel has `id="assign"` and, when the page loads with `#assign`, scrolls to and focuses it (`focusAssignPanel` in `src/lib/client.ts`, which respects reduced motion).
- Over-allocated uses `--danger` on the plain summary card, not on a surface, following the theme rule.
- Until PR 2 the Overview destination (`/`) is still the old page (household name and a greeting).
- Tests: `tests/plan.test.ts` (summary numbers against real data, over-allocation, past months) and `tests/plan-ui.test.tsx` (server-rendered markup with `usePathname` mocked: active tabs and header items, month handling in links, Assign link versus button, hidden Assign cases, and the over-allocated state).

## Not verified (PR 1)
Not clicked through in a browser: the live update of the summary while typing an amount, the Assign scroll and focus behavior (from the button and from another page via `#assign`), and how the header looks at phone width with three items plus the name, sign out and theme switch.
