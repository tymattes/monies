# 010: Provisional income for months that are still in progress

**Status:** implemented

## Goal
Stop crying wolf about over-allocation for households with variable income. Today a month's income is the fixed amounts plus the deposits recorded so far. For a household with a variable source (freelance, sales, bonuses) that figure is incomplete until the month is over, and it is empty of variable income for any future month. So the app shows red "Over-allocated" and "Bills exceed income" warnings that mean only "you have not recorded this month's deposits yet". This spec marks such income as **provisional** and softens those messages, while keeping the alarm for cases that really are errors.

This resolves the follow-up logged in spec 008 ("next month starts out over-allocated whenever this month's income includes a one-off deposit"). It also affects the current month, which has the same problem early on (for example on the 1st, before any deposit arrives).

## Requirements
- **Provisional income.** A month's income is *provisional* when the month is the current month or a later one **and** the household has at least one variable income source active in that month. Otherwise it is *final* (past months, and households with only fixed income).
- **Amounts do not change.** Income is still the fixed amounts plus recorded deposits, Unallocated is still income minus budgeted, and every total stays consistent between the Plan pages, the Overview and the API. Only the wording, tone and severity change.
- **Plan summary bar (Budget, Bills, Income) and the Overview cash-flow card**, when income is provisional:
  - The Income figure carries a small note: "Variable income counts once you record it."
  - If budgeted is above income, the label reads **"Over recorded income by"** and is shown in the normal text color, not the error color. The cash-flow bar's income line and its legend entry are also neutral, and Assign stays hidden as before.
  - If bills are above income, the Overview label reads "Bills exceed recorded income by", also neutral.
- **Overview "Needs attention":** for provisional income, `over_allocated` and `bills_exceed_income` become **info** items (no error edge, no "Warning" prefix) with softer wording that says the income is what has been recorded so far ("You have budgeted $X more than the income recorded so far. Variable income counts once you record it."). For final income they stay warnings with the current wording.
- **Unchanged:** `category_bills_over_budget` stays a warning (it compares bills to a category's own budget, not to income), and the unallocated, no-income and no-bills items are unchanged.
- **API:** `GET /api/budgets/[month]` and `GET /api/overview/[month]` return `incomeProvisional` (boolean), and the attention items carry the new severity and wording, so a future native client behaves the same.

## Out of scope
An "expected variable income" estimate or forecast, averaging past deposits, per-source expectations, changing how income is summed or how budgets carry forward, and any change to past months (which are final).

## Acceptance criteria
- [x] `incomeProvisional` is true only for the current or a future month with an active variable source; false for past months and for fixed-only households (covered by tests).
- [x] With provisional income and budgeted above income, the Plan summary bar and the Overview show "Over recorded income by" in a neutral color with the variable-income note; with final income they keep "Over-allocated by" in the error color (covered by render tests and in the browser).
- [x] The `over_allocated` and `bills_exceed_income` attention items are info with the softer wording when provisional, and warnings otherwise (covered by tests); `category_bills_over_budget` is always a warning.
- [x] Amounts, Unallocated and the cash-flow segments are identical to before (existing tests still pass unchanged apart from wording).
- [x] `GET /api/budgets/[month]` and `GET /api/overview/[month]` expose `incomeProvisional`.
- [x] The seeded browser scenarios cover both cases: a household with a variable source (softened) and one with only fixed income (still a red warning).
- [x] Documentation updated; `npm run lint`, `npm test`, `npm run build` and `npm run test:e2e` pass.

## Technical notes
- `getIncomeMonth` already lists the sources visible in a month; add `provisional = month >= currentMonth() && any source.kind === "variable"` there. `getBudget` passes it through as `incomeProvisional`, `getPlanSummary` and `getOverview` expose it.
- `PlanSummary` and `CashFlowCard` take an `incomeProvisional` prop; `BudgetEditor` receives it from the Budget page so the live summary keeps the same wording.
- Attention item text for the provisional case lives in `getOverview` beside the existing messages.
- Tests: extend `tests/overview.test.ts` and `tests/plan.test.ts`, add render cases to `tests/plan-ui.test.tsx` and `tests/overview-ui.test.tsx`, and add a `variable: false` option to the browser-test seed so both households exist in `e2e/`.

## Decisions
- Softening the message beats hiding it: the household is still told the budget is above recorded income, just without an alarm, because for a variable earner that is normal early in the month.
- The rule applies to the current month as well as future ones, since the current month has the same gap until deposits are recorded.
- Households with only fixed income keep the red warning everywhere: for them the income figure is complete, so over-allocation is a real error.

## Documentation
- `README.md`: mention provisional income where the Overview and Plan summary are described.
- `CLAUDE.md`: the provisional-income rule and where it is computed.
- `specs/008-overview-and-plan.md`: mark the follow-up resolved.

## Verification
With a variable income source, look at this month and next month on the Budget page and the Overview when the budget is above recorded income: the wording should read "Over recorded income by", in the normal color, with the variable-income note, and the attention item should be a plain note. Remove the variable source (or use a household with only salary) and confirm the red "Over-allocated by" and the warning return. Check both themes and phone width, and run tests, lint, build and the browser suite.

## Implementation notes
- `getIncomeMonth` sets `provisional` (`month >= currentMonth()` and an active variable source, even one with no deposits yet); `getBudget` exposes it as `incomeProvisional`, and `getPlanSummary` and `getOverview` pass it on. Archiving the variable source (from this month on) makes the month final again, and a past month is always final.
- Amounts and every total are untouched; only labels, tone and attention severity depend on the flag. `PlanSummary` and `CashFlowCard` take `incomeProvisional`; the Budget page passes it into `BudgetEditor` so the live summary reads the same. Over-budget-vs-income uses `text-foreground` styling and a neutral income line when provisional, and the error styling otherwise; the Utilities-style `category_bills_over_budget` item is never softened.
- The variable-income note under the Income figure uses `text-balance` so it does not wrap with a lone word.
- Tests: 15 new unit tests in `tests/overview.test.ts` (when income is provisional, severities and wording, no amounts change, the one-off-deposit next-month case), render cases in `tests/plan-ui.test.tsx` and `tests/overview-ui.test.tsx`, and browser tests for both households: the seeded one with a variable source (softened, neutral color, plain note) and a new fixed-only seed (`resetAndSeedFixedOnly`) that must still show the red "Over-allocated by" and a warning. The screenshot set gained `overview-over-recorded-*` (softened) alongside `overview-over-allocated-*` (real error).
- Verified in real Chromium with screenshots reviewed in both themes and at phone width for both states.

## Not verified
Real Safari and iOS (the WebKit project is not run).
