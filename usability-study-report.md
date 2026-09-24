# Monies — Usability Study (new-user walkthrough)

Date: 2026-09-23
Environment: fresh instance spun up alongside the existing test app — Compose project
`monies-study`, ports 3001 (app) / 5433 (db), database `monies_study`, image reused (no rebuild).
Existing `monies-app-1` (3000) and `monies-db-1` (5432) were left running and untouched throughout.

Method: I signed up as a brand-new user (household "The Matteson Household", owner "Tyler"),
then followed the app's own Philosophy (Plan → Expenses → Overview) end to end:
setup → income → category budgets → bills → goals → variable income deposit → expenses →
assign unallocated → check off goals → overview review. Every number below was entered through
the real UI and checked against the invariant `unallocated = income − bills − expenses − checked goals`.

Final state of the test month (September 2026):

- Income: $6,200.00 (Salary $5,000 fixed + Freelance $1,200 variable deposit)
- Bills: $1,970.00/mo (Rent $1,800 Housing; Internet $70 Utilities; Car insurance $600/6-mo → $100/mo Transport)
- Category budgets: $3,350.00 across 8 categories
- Goals: Savings $1,500 (saving, checked), Credit card $1,300 (debt payoff, checked)
- Expenses: $165.90 (Groceries $85.40, Dining out $42.00, Transport $38.50)
- Unallocated Income: $1,264.10  (= 6200 − 1970 − 165.90 − 1500 − 1300 ✓)

---

## What works

The core loop is coherent and the math holds up everywhere I checked. Specifics:

- Setup: one screen, sensible defaults (USD preselected, currency list, household + owner created in a single step), and it lands on the Overview with a clear "Let's get your month set up" checklist.
- Onboarding helpers: 8 default categories and a default "Savings" goal mean a new user can be productive immediately.
- Income: fixed and variable sources both work; variable deposits are counted in the month they're received, and the "Variable income counts once you record it" note explains why recorded income may lag.
- Bills: interval options (month / 3 / 6 / 12 months) with a correct monthly-equivalent spread and a live "= $100.00 / month" preview for non-monthly bills. Editing/ending a bill is versioned (past months read-only).
- Budget: inline amounts save on blur with a "Saving… / Saved" status, totals update live, and the "changes apply from this month onward" rule is stated clearly.
- Goals: saving vs debt-payoff types, per-month check-off, grouping by type, and correct one-month-top-up revert behavior for Assign.
- Expenses: quick single-line log, date clamped to the viewed month, future dates refused (both by a `max` on the input and by the API), delete-only (a "fact", no edit) which matches the design.
- Overview: the cash-flow bar draws the four real terms (Bills, checked Saving, checked Debt payoff, Expenses) plus Unallocated, and its text alternative is correct. The Budget table's spend bars are decorative-but-`aria-hidden` with the numbers carrying the information, plus an explanatory footnote. The four cards (Income / Bills / Expenses / Goals) are well populated and each links out with the right verb ("Add income", "Add bill", "Log expense", "Check off").
- Assign: goals-only target (categories correctly rejected), "Fill remaining" / "Split evenly" helpers, a clear "X of Y — Z left" live total, an atomic advisory-lock transaction, and an explicit note that the top-up reverts next month.
- Consistency: the unallocated invariant ($1,264.10) matched across Overview, Plan summary, and my own arithmetic.

## Bugs / issues

1. (Medium) Checking off a goal — and editing a goal's amount — leaves the Plan summary stale on the Goals page.
   Repro: on /goals, check off a goal. The checkbox flips and the API saves, but the "Unallocated Income" figure in the Plan summary above does not change (it stayed $4,064.10 after both goals were checked). Navigate anywhere and it correctly shows $1,264.10.
   Root cause: `src/components/GoalEditor.tsx` — both `commit()` (amount, ~line 47) and `toggle()` (check-off, ~line 64) save via the API and update local state but never call `router.refresh()`. Every sibling editor does: `IncomeView.commit` (line 68), `BillsView.add/save`, `ExpenseLog.add/remove`, and `GoalManager.run` all refresh. `BudgetEditor` gets away without it because it feeds its own client-side totals into `PlanSummary`. `GoalEditor` does not — the Plan summary on /goals is server-rendered, so it goes stale until navigation.
   Fix: add `router.refresh()` after the successful API call in both functions (import `useRouter`).

2. (Low) "Needs attention" wording is misleading: "$1,264.10 is not assigned to a category yet."
   The action it links to ("Assign", `/income#assign`) can only target goals — categories are never a valid Assign target (spec 020). Telling the user the money isn't "assigned to a category" points them at the wrong concept.
   Location: `src/lib/overview.ts:193`. Suggest "…is still unallocated" or "…hasn't been assigned to a goal yet".

3. (Low, inconclusive) One silent JS exception (empty message) was logged once at first-run setup; it did not recur and I could not trace it. Separately, pressing Enter in a goal amount field once navigated the session to `about:blank` and required re-sign-in — but the same Enter→blur pattern works on income and budget, and `GoalEditor` has no form wrapper, so this is almost certainly a browser-automation artifact rather than an app bug. Worth a one-time manual sanity check, not a code change.

## UX / polish observations (not bugs)

4. Assign → check-off is a two-step that can confuse. Assigning $1,000 to a goal raised its target (Savings $500→$1,500) but "Unallocated Income" did not drop until the goal was checked off. This is correct per the plan-vs-fact model (spec 022), but the Assign panel only explains the one-month revert, not that the money isn't claimed until check-off. Consider adding one line of copy, or offering a combined "assign and check off" action.
5. The onboarding checklist ("Let's get your month set up") lists income, budgets, and bills but omits goals — a core part of the Plan per the app's own Philosophy. Add "Add your goals".
6. The expense form's "Description (optional)" field sits outside the `<form>` element and below the "Add expense" button (`ExpenseLog.tsx`). Enter in that field won't submit the form, and it reads as detached from the entry it belongs to.
7. The setup currency selector is a raw ~160-entry native `<select>`. A searchable or grouped picker would be friendlier for a first-run user.
8. The bill "Paid with" field is a free-text `<datalist>` rather than a member picker. Moot with a single member, but it should become a real member selector for multi-member households (per-member income is already a concept).

## Feature ideas

- Receipt capture (already on the roadmap): photograph → parse merchant/date/total/line items → review before save; it pairs naturally with the existing Expenses quick-log.
- Trends: budget-vs-actual over time and per-category trends (roadmap). The data model (time-versioned rows, read-only past) already supports this cleanly.
- Guided first-run wizard with optional sample data, to complement the existing checklist and default categories/goal.
- Per-member income and spend views (the brief calls for household-level and per-member dashboards; only income is per-member today).
- Searchable/grouped currency picker (ties into #7).
- An "undo last check-off / expense" affordance — check-off already toggles, but expenses are delete-only with no adjacent confirmation beyond a confirm dialog.
- Clearer Assign semantics (see #4) — possibly rename the action to "Move to goals" with an explicit "money is claimed when the goal is checked off" note.

## Not covered / limits

- Visual/theme verification (light vs dark) and exact pixel rendering were not assessed — the browser tooling here has no screenshot/vision step. The repo's `npm run e2e:screenshots` and the `theme.test.ts` contrast suite are the right tools for that pass.
- Mobile/responsive behavior was not exercised (the tables do ship a mobile collapsed-column pattern, but I did not resize the viewport).
- Multi-member invites/roles were not exercised (single-owner household).
- The `dogfood` skill's screenshot-evidence workflow was adapted: evidence here is from the accessibility-tree snapshots and live DOM/console queries rather than annotated screenshots.
