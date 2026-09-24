# 032: Needs attention becomes Tasks, and Assign moves to Goals

**Status:** approved

## Goal

Usability testing raised two related points about Overview's "Needs attention" list: it only ever shows up when something's already missing or wrong, so it says nothing about the routine monthly upkeep (logging expenses, keeping income and bills current) a household should be doing regardless; and Assign-unallocated is duplicated — it's both an item in that list and a separate button inside the cash-flow card. Rename the section "Tasks", give it three permanent monthly reminders alongside its existing checks, and let Assign live there as one task instead of two places. Assign itself moves off the Income page onto Goals, near the top — the two pages it connects (leftover income and the goal it funds) sit together, and a successful assign is confirmed right next to where you'll check the goal off.

## Requirements

### Tasks (renamed from Needs attention)

- The Overview heading "Needs attention" becomes "Tasks". No other change to its position or styling (warnings keep the red edge; everything else keeps the neutral one).
- Three permanent tasks show whenever viewing the current month, regardless of whether anything's missing: **Log expenses** (→ Expenses), **Update income** (→ Income), **Update bills** (→ Bills). These replace the old conditional "No income yet" / "No recurring bills yet" items, which only fired when the total was zero — the new ones are unconditional monthly nudges.
- These three (and the existing goal-check-off reminder) are scoped to the current month only — a past month is for review and a future month has nothing to do yet, the same reasoning spec 015 already applies to the check-off reminder.
- The existing checks keep their current triggers and wording unchanged: over-allocated, bills exceed income, a category over its budget, a funded goal not yet checked off this month.
- Assign-unallocated keeps its existing trigger (`budget.editable && unallocatedCents > 0`) as a Tasks entry, but now points at the Goals page (see below) instead of Income.
- The cash-flow card's own "Assign" button is removed — Assign appears once, in Tasks, not twice.

### Assign moves to Goals

- `AssignUnallocated` renders on the Goals page (`src/app/goals/page.tsx`) instead of the Income page, positioned near the top — directly under `PlanHeader`, before the "Amounts apply from this month onward…" explanatory paragraph and the goal check-off list.
- The Income page no longer renders it.
- Every link that currently points at `/income...#assign` (Tasks' assign item, the Plan summary's Assign action, and `AssignUnallocated`'s own hash-arrival handling) points at `/goals...#assign` instead.
- The post-assign confirmation copy in `AssignUnallocated` ("Check it off on Goals when the money moves", spec 026) no longer needs to link elsewhere — you're already on Goals. Reword it to something like "Check it off below when the money moves" without the link.

## Out of scope

- The Plan summary card's own task display — spec 033.
- Changing how Assign itself splits or applies amounts (spec 016/017/020).
- Renaming the underlying `AttentionCode`/`AttentionItem` types is an implementation detail, not a behavior requirement (see Technical notes).

## Acceptance criteria

- [x] Overview's section is titled "Tasks".
- [x] Viewing the current month always shows Log expenses, Update income and Update bills, whether or not anything's been entered.
- [x] A past or future month never shows those three.
- [x] Assign-unallocated appears once, as a Tasks entry, linking to the Goals page's panel — not inside the cash-flow card.
- [x] The Assign panel renders near the top of the Goals page and no longer on Income.
- [x] A successful assign's confirmation text doesn't link back to Goals from Goals.
- [x] Existing warning/info tasks (over-allocated, bills exceed income, category over budget, goal not checked off) keep their current wording and triggers.
- [x] Documentation updated (see Documentation).

## Technical notes

- `src/lib/overview.ts`: drop the `no_income`/`no_bills` codes and their conditions; add unconditional `log_expenses`/`update_income`/`update_bills` items gated on `month === currentMonth()`; change the `unallocated` item's `href` to `/goals${q}#assign`. Done: renamed `AttentionCode`/`AttentionItem`/the `attention` field to `TaskCode`/`Task`/`tasks` for clarity now that the concept has changed.
- `src/components/overview/AttentionList.tsx`: renamed to `TaskList.tsx`; heading text "Needs attention" → "Tasks".
- `src/components/overview/CashFlowCard.tsx`: remove the `assignHref` prop and the "Assign" link inside the Unallocated stat; `src/app/page.tsx` drops the prop it was passing.
- `src/app/goals/page.tsx`: render `<AssignUnallocated>` using the `budget` it already fetches for `planSummaryFromBudget` (no new query), guarded the same way the Income page guards it today (`budget.editable && budget.unallocatedCents > 0`).
- `src/app/income/page.tsx`: remove the `AssignUnallocated` block; keep the `budget` fetch, still needed for `planSummaryFromBudget`.
- `src/components/PlanSummary.tsx`: the Assign link's `href` becomes `/goals?month=${month}#assign`.
- `src/components/AssignUnallocated.tsx`: doc comment and confirmation copy updated for its new home; hash-arrival scroll behavior is unchanged.

## Documentation

- `README.md`: "Needs attention" → "Tasks" everywhere it's named, and its description gains the three permanent reminders; "Assign panel (on the Income page)" (Goals bullet) and "the Income page offers an Assign panel" (Assign bullet) → the Goals page; "an Assign button in the bar takes you to the Assign panel on the Income page" (Plan area bullet) → the Goals page, and note it's now reached from Tasks, not the cash-flow card.
- `CLAUDE.md`: `AssignUnallocated.tsx` bullet — "Lives on the Income page (spec 015)" → "Lives on the Goals page (spec 032)". `AttentionCode`/`unallocatedCents` invariant sentence updated if the rename in Technical notes is carried out.

## Verification

- `npx vitest run tests/overview.test.ts tests/overview-ui.test.tsx tests/plan-ui.test.tsx tests/goals.test.ts tests/income.test.ts`
- `npx playwright test e2e/goals.spec.ts e2e/plan.spec.ts e2e/overview.spec.ts` (update any that assert Assign lives on Income)
- Manual: on a month with unallocated income, confirm Tasks lists Assign once, linking to Goals; confirm the cash-flow card no longer has its own Assign button; complete an assign from Goals and confirm the confirmation text makes sense without a link.
