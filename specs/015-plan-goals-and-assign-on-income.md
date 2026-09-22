# 015: Goals under Plan, Assign moves to Income, a check-off reminder,
a Goals overview card, "Unallocated Income"

**Status:** implemented

## Goal
Five small corrections to spec 014's shape, based on using it: Goals felt
like an orphaned destination sitting outside the Plan group it's actually
part of; the Assign panel lived on the Budget page for historical reasons
(it started there before goals existed) even though it now sends money to
either a category or a goal, which fits the Income page's "here's what
came in, here's where it's going" framing better than Budget's "here's what
each category gets" framing; a goal's monthly checkmark had no visible
reminder, so it was easy to fund a goal and forget to confirm it; the
Overview page summarized Income and Bills but not Goals, so seeing goal
progress meant leaving the page; and "Unallocated" read ambiguously once
goals and, eventually, expenses can both draw down the same pool of money.
This spec is groundwork, not the final shape — a later spec will introduce
allocating both income and expenses together, which these moves set up
for.

## Requirements
- **Goals becomes the 4th Plan tab** (Budget | Bills | Income | Goals),
  replacing its own top-level nav destination. `HeaderNav` drops to three
  items: Overview, Plan, Members. "Plan" is active on `/budget`, `/bills`,
  `/income`, and `/goals` alike.
- **The Goals page gains the shared `PlanHeader`/`PlanTabs`/`PlanSummary`**,
  the same as Bills and Income, instead of its own bespoke header — so it
  reads as part of the same plan (month switcher, and now Income/Budgeted/
  Unallocated at the top) rather than a separate feature.
- **Assign-unallocated moves from the Budget page to the Income page.** The
  panel itself (choose one or more categories/goals and an amount each,
  "Split evenly", apply in one click) is unchanged — same API, same rules.
  Every other page's Assign button becomes a link to Income; Income's own
  Assign button scrolls to its own panel, the way Budget's used to.
- **Needs attention reminds you to check off a goal.** For the *current*
  month, any goal (Saving or Debt payoff alike) with a nonzero amount that
  has not been checked off yet gets its own attention item, linking to
  Goals. A goal at $0 for the month is skipped (nothing to confirm); future
  and past months don't show it (nothing to confirm yet, and past months
  are for review — the same reasoning already applied to the other
  setup-style prompts).
- **A Goals card joins Income and Bills on the Overview page.** Same card
  pattern (heading, a "Manage" link to Goals, a total, a breakdown, a list),
  showing only goals funded this month (an unfunded goal has nothing to
  report, same reasoning as the check-off reminder): the combined total,
  Saving/Debt payoff subtotals, and each funded goal's amount plus whether
  it's been checked off. The Income/Bills grid becomes three columns
  (`md:grid-cols-3`) to fit it.
- **"Unallocated" becomes "Unallocated Income" everywhere it's a label**:
  the Plan summary bar (all four tabs), the Overview cash-flow card's stat
  and bar legend, and the cash-flow bar's text-equivalent `aria-label`.
  Internal names (the `unallocated` attention code, `assignUnallocated`,
  `unallocatedCents` fields) are unchanged — this is a display-label rename
  only, ahead of a future spec that will need to distinguish unallocated
  *income* from money not yet assigned on the expense side.

## Out of scope
- The "allocate both income and expenses together" concept mentioned above
  — that's a future spec once this groundwork lands.
- Any change to the Assign API, its locking behavior, or what it can target
  (spec 007/014 already cover that) — this spec only moves where the panel
  lives in the UI.
- Any change to how a goal's amount or checkmark themselves work (spec
  014) — only where the reminder to check one off shows up.
- Playwright/e2e coverage. e2e is currently paused project-wide (owner's
  call, to cut token usage) with a future feature planned to bring it back;
  this spec ships with Vitest coverage only, same as every spec since the
  pause. `e2e/` files that reference the old `/goals` header or
  `/budget#assign` become stale and are left as-is rather than updated, to
  be reconciled whenever e2e resumes.
- The Goals card is read-only, like Income and Bills — no checking off a
  goal from the Overview page itself; that stays on `/goals`.
- The "Unallocated Income" rename touches only the literal word
  "Unallocated" used as a label. "Over-allocated by", "Over recorded income
  by", and the `unallocated` attention item's "is not assigned to a
  category yet" message are unchanged.

## Acceptance criteria
- [x] `HeaderNav` shows exactly Overview, Plan, Members; "Plan" is active on
      `/budget`, `/bills`, `/income` and `/goals` (covered by a render test).
- [x] `PlanTabs` includes Goals as a 4th tab; the Goals page renders via
      `PlanHeader` with a `PlanSummary` bar, same as Bills/Income (covered
      by render tests).
- [x] The Assign panel appears only on the Income page, anchored at
      `#assign`; Budget, Bills, Goals, and the Overview's cash-flow card and
      "unallocated" attention item all link to `/income...#assign` instead
      of `/budget...#assign` (covered by tests).
- [x] Assigning to a category or a goal from the Income page works
      end-to-end exactly as it did on Budget (covered by tests exercising
      the same scenarios `tests/assign.test.ts` already has — that file
      hits the API directly, which is unchanged, so it needed no changes).
- [x] A goal with a nonzero amount, not checked off, in the current month
      produces one Needs-attention item per goal (both Saving and Debt
      payoff), linking to Goals; a $0 goal, a checked-off goal, and any
      goal viewed from a past or future month produce none (covered by
      tests).
- [x] The Overview page shows a Goals card alongside Income and Bills
      (three-column grid), totaling only funded goals, split by type, with
      each funded goal's amount and checked status; a month with nothing
      funded shows an empty state instead (covered by tests).
- [x] Every "Unallocated" label site-wide (Plan summary, cash-flow stat,
      cash-flow legend, cash-flow bar's `aria-label`) reads "Unallocated
      Income"; the `unallocated` attention code, `assignUnallocated`, and
      `unallocatedCents` fields are untouched (covered by tests).
- [x] Documentation updated (see Documentation).

## Technical notes
- **`src/components/HeaderNav.tsx`**: drop the "Goals" item; add `/goals`
  to `PLAN_PATHS`.
- **`src/components/PlanTabs.tsx`**: add `{ href: "/goals", label: "Goals" }`
  to `TABS`.
- **`src/components/PlanHeader.tsx`**: `title` gains `"Goals"` as an allowed
  value (the `title.toLowerCase()` → basePath trick already produces
  `/goals`, no special-casing needed).
- **`src/app/goals/page.tsx`**: call `getPlanSummary(ctx, month)` alongside
  the existing `getGoalsMonth`/`listGoals` calls; replace the bespoke
  `<header>`/`MonthNav` block with `<PlanHeader title="Goals" month={month}
  now={now} summary={summary} />`. Drop the file's "not a Plan tab" comment
  (spec 014's reasoning is superseded here).
- **`src/lib/plan.ts`**: split `getPlanSummary` into a pure
  `planSummaryFromBudget(b: Budget, month: string): PlanSummaryData` plus a
  thin `getPlanSummary` that calls `getBudget` then the pure function — so
  the Income page (which needs the full `Budget` for Assign anyway) can
  build its summary from one `getBudget` call instead of querying twice.
- **`src/components/AssignUnallocated.tsx`** (new, extracted from
  `BudgetEditor.tsx`): the same component, moved to its own file and
  restyled from a `<li>` (it lived inside `BudgetEditor`'s category `<ul>`)
  to a standalone `${cardCls} p-5 space-y-3` section, still `id="assign"`
  so `focusAssignPanel()` keeps working unchanged. Props unchanged
  (`month`, `monthName`, `currency`, `lines`, `goals`, `unallocated`).
- **`src/app/income/page.tsx`**: fetch `getBudget(ctx, month)` instead of
  `getPlanSummary`; derive `summary` via `planSummaryFromBudget`; render
  `<AssignUnallocated>` as its own section after `IncomeView` when
  `budget.editable && budget.unallocatedCents > 0`, passing
  `lines={budget.categories}`, `goals={budget.goals}`,
  `unallocated={budget.unallocatedCents}`.
- **`src/components/BudgetEditor.tsx`**: delete the local `AssignUnallocated`
  function and its rendering at the bottom of the category list; its
  `PlanSummary` changes from `assign="scroll"` to `assign="link"`.
- **`src/components/PlanSummary.tsx`**: the "link" variant's `href` changes
  from `` /budget?month=${month}#assign `` to `` /income?month=${month}#assign ``.
- **`src/lib/overview.ts`**: the `unallocated` attention item's `href`
  changes to `` /income${q}#assign ``. New loop, gated on
  `month === currentMonth()`: for each `g` in `budget.goals` where
  `g.amountCents > 0 && !g.checked`, push `{ code: "goal_not_checked",
  severity: "info", message: `${g.name} hasn't been checked off yet this
  month.`, href: "/goals", actionLabel: "Check off", amountCents:
  g.amountCents, goalId: g.id }`. `AttentionCode` gains
  `"goal_not_checked"`; `AttentionItem` gains an optional `goalId?: string`
  alongside the existing `categoryId?: string`.
- **`src/components/overview/AttentionList.tsx`**: list key becomes
  `` `${item.code}-${item.categoryId ?? item.goalId ?? ""}` `` so multiple
  unchecked goals don't collide.
- **`src/app/page.tsx`**: `assignHref` passed to `CashFlowCard` changes to
  `` `/income${q}#assign` ``; grid becomes `md:grid-cols-3` with a new
  `<GoalsCard goals={o.goals} currency={o.currency} href={`/goals${q}`} />`
  alongside Income and Bills.
- **`src/lib/overview.ts`**: `Overview` gains `goals: OverviewGoal[]`
  (`{ id, name, type, amountCents, checked }`, the same shape
  `getGoalsMonth`/`getBudget` already produce — `getOverview` just passes
  `budget.goals` through, no new query).
- **`src/components/overview/GoalsCard.tsx`** (new, follows
  `IncomeCard`/`BillsCard`'s card shape): filters `goals` to
  `amountCents > 0`; empty state "No goals funded this month yet." when
  none; otherwise a total, a Saving/Debt payoff breakdown (each subtotal
  hidden at zero, same as `CashFlowCard`'s per-type stats), and a list of
  each funded goal with its amount and "Checked off" / "Not checked off
  yet".
- **`src/components/PlanSummary.tsx`**: the `"Unallocated"` label becomes
  `"Unallocated Income"` (the over-allocated labels are untouched).
- **`src/components/overview/CashFlowCard.tsx`**: same rename for the stat
  label and the legend `<span>`; the `aria-label` summary's `` `...
  unallocated` `` suffix becomes `` `... unallocated income` `` in both the
  split and unsplit branches.
- **Tests**: update `tests/plan-ui.test.tsx` (`HeaderNav` expects
  `["Overview", "Plan", "Members"]`; `PlanTabs` gains a Goals case; the
  `PlanSummary` link-href tests move to `/income`; the label assertions
  become `"Unallocated Income"`); update
  `tests/overview.test.ts`/`tests/overview-ui.test.tsx` for the new
  `/income#assign` hrefs, the new `goal_not_checked` cases (present, absent
  at $0, absent when checked, absent outside the current month), the
  `"Unallocated Income"` label and `aria-label` wording, a new
  `data.goals` passthrough case, and a new `GoalsCard` describe block;
  move/rewrite the Assign scenarios in `tests/assign.test.ts` if they
  render `BudgetEditor` directly (check first — most of that file already
  hits the API, which is unchanged, so it may need no changes at all).

## Decisions
- **Both goal types get the reminder, not Saving only.** A Debt payoff
  goal's checkmark exists for exactly the same reason a Saving goal's does
  (spec 014: "did I do this" for money the app can't observe) — singling
  out Saving would be an arbitrary asymmetry with no product reason behind
  it.
- **Current month only, not past months too.** The other setup-style
  attention items (`unallocated`, `no_income`, `no_bills`) already only
  show for editable (current/future) months, on the reasoning that a past
  month is for review, not action. A future month has nothing to confirm
  yet either way (the checkmark records something that already happened).
  Current month is the one place both "there's something to confirm" and
  "it's still timely to ask" are both true.
- **The Assign panel's shape doesn't change, only its page.** It already
  targets categories and goals in one call (spec 014); moving it to Income
  is a relocation, not a redesign — Income is where "money coming in" and
  "where it's going" naturally sit together, more than Budget's per-category
  editing view ever was.
- **Goals gains a `PlanSummary` bar it didn't have before**, for
  consistency with Bills and Income now that it's a Plan tab — a household
  loses nothing (it's additive), and it gives the new Income-hosted Assign
  button a natural landing state on every Plan page.
- **The Goals card only lists funded goals, mirroring the check-off
  reminder's own definition of relevance.** A household with several goals
  but only one funded this month would otherwise see a wall of $0.00 rows —
  the same "nothing to see at zero" reasoning `CashFlowCard`'s Saving/Debt
  payoff stats already use.
- **Rename the label now, not the internal names.** The `unallocated`
  attention code, `assignUnallocated`, and every `unallocatedCents` field
  are load-bearing identifiers touched across routes, tests and this
  file's own history; renaming them for a wording change would be pure
  churn. Only the word a person actually reads changes.
- **"Unallocated Income" ahead of the expenses spec, not after.** The
  ambiguity exists today — once a household earmarks money for goals as
  well as categories, "Unallocated" alone doesn't say *unallocated what*.
  Waiting for the expenses spec to also land a same-conversation rename
  would just mean two UI changes instead of one; this spec is already
  touching every place the label lives.

## Documentation
- `README.md`: update the "Plan area" bullet (Goals is now a 4th tab, next
  to Overview and Members at the top level rather than beside them; the
  summary bar's unallocated figure reads "Unallocated Income"); update
  "Assign unallocated" (now lives on the Income page); update the
  "Saving and Debt payoff goals" bullet to drop "a separate Goals page"
  language; update "Overview" to mention the new check-off reminder and the
  new Goals card (three-column grid, funded goals and their check-off
  status), and its "unallocated money" → "unallocated income".
- `CLAUDE.md`: update the Navigation bullet (three top-level destinations,
  Goals as PlanTabs' 4th entry), the Assign-unallocated bullet (Income page,
  not Budget), and the Overview bullet (new `goal_not_checked` attention
  code and its current-month-only rule, the `Overview.goals` passthrough
  behind `GoalsCard`, and the "Unallocated Income" label rename).
- `specs/014-savings-debt-goals.md`: note that spec 015 moved Goals into
  the Plan tab group and Assign onto Income, superseding that spec's
  "Goals is deliberately not a fourth tab" decision.

## Verification
`npm run dev`: confirm the header shows Overview / Plan / Members only, and
Plan stays highlighted on Budget, Bills, Income and Goals. Confirm Goals
now shows the month switcher and a summary bar matching Bills/Income.
Confirm the Assign panel no longer appears on Budget, and does appear on
Income, reachable both directly and via every "Assign" button/link
elsewhere (Budget, Bills, Goals, Overview's cash-flow card, Overview's
"unallocated" item) — each should land on Income's panel, focused. Fund a
goal for the current month, leave it unchecked, and confirm Needs attention
shows a reminder for it; check it off and confirm the reminder disappears;
confirm a $0 goal and a past/future month never show it. Check both themes
and phone width. Run `npm test`, lint, and build (e2e is paused — see Out
of scope).
