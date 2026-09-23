# 016: Allocation UX — informed splits, a cleaner Assign panel

**Status:** implemented

## Goal
The Assign panel (spec 015, on the Income page) lets a household put its
unallocated income into categories and goals in one click, but it makes
that decision harder than it should be: every target is just a bare name,
so you allocate blind — you can't see how much a category or goal already
has while deciding how much to give it, and the leftover amount only
appears in a small footnote. The rows also wrap untidily once there is
more than one. This spec makes allocation informed and legible without
changing what the panel can do: surface each target's current amount,
keep the remaining amount in view as you type, align the rows, and add a
one-click way to use up the remainder. No API, schema, or locking changes
— the data already flows from `getBudget`.

## Requirements
- **Each target shows its current amount while you choose it.** In the
  Assign row's `<select>`, category options read `Name · $X budgeted` and
  goal options read `Name · $X`, so the split is made against what already
  exists rather than from memory. Amounts are the month's figures already
  in the panel's props (`lines[i].amountCents`, `goals[i].amountCents`) —
  formatted with the household currency, no new query.
- **The remaining amount stays in view as a summary line** near the top of
  the panel (not only in the bottom footnote), reading the running total
  and what is left: `Assigning $X of $Y — $Z left`. It updates as amounts
  are typed, and turns `text-danger` when the typed total exceeds the
  unallocated amount (matching the existing overrun behavior). It is a
  plain visual summary, not `aria-live` — the existing bottom footnote
  (which carries strictly more: the over-limit wording and the "applies
  from {monthName} onward" framing) stays the sole `aria-live="polite"`
  region, so nothing gets announced twice per keystroke.
- **Rows align into a grid.** The target `<select>`, amount `<input>` and
  Remove button sit on a stable grid (`grid-cols-[1fr_auto_auto]` or
  similar) instead of `flex flex-wrap`, so multi-row splits read as a
  column of aligned controls rather than a tumble of wrapped ones. The
  single-row default must not regress (the row is still the same three
  controls on one line).
- **A per-row "Fill remaining" action consumes the leftover.** Each row
  offers a small secondary action that sets that row's amount to absorb
  the remaining total (`amount = unallocated − Σ other rows`), shown only
  while the panel's overall `left > 0`. That single gate is sufficient on
  its own to keep every row's fill amount positive and the resulting total
  at exactly `unallocated` — no per-row over-assignment is possible. The
  existing "Split evenly" stays as is.
- **The panel keeps its current page, anchor and behavior.** Still
  `#assign` on `/income`, still reaches the same API, still preselects the
  first Saving goal, still never preselects Debt payoff. This spec is
  presentation and interaction only.

## Out of scope
- Moving the Assign panel relative to the income source list on the
  Income page (e.g. above the members or into the summary bar). That is a
  layout decision worth its own discussion and is not needed for the
  informed-split improvements above; see Decisions.
- Any change to the Assign API, its transaction/advisory lock, or what it
  can target (spec 007/014/015 already cover these).
- Editing a target's current amount from the Assign panel (that stays on
  Budget and Goals); the current amounts are shown, not edited.
- "Fill each to a target" or minimum-balance rules — future work, if ever.
- Playwright/e2e coverage. e2e is paused project-wide (owner's call, to
  cut token usage); this spec ships with Vitest coverage only, same as
  every spec since the pause.

## Acceptance criteria
- [x] Each category option in the Assign row reads `Name · $X budgeted`
      and each goal option reads `Name · $X`, with the current month's
      amount formatted in the household currency (covered by a render
      test; confirmed live in the browser — "Groceries · $1,000.00
      budgeted", "KT Brokerage · $300.00").
- [x] The panel shows an `Assigning $X of $Y — $Z left` summary line near
      the top that updates as amounts change and turns `text-danger` on
      over-assignment; it is not `aria-live` (the existing bottom footnote
      remains the sole live region, so nothing double-announces). The
      default "equal" state (left = $0.00, not danger) is covered by a
      render test; the under/over states were confirmed live in the
      browser (typing over the unallocated amount turned the line and the
      footnote red together; this project's static `renderToStaticMarkup`
      Vitest setup can't simulate typing, so it isn't automated).
- [x] Multi-row panels render their target/amount/remove controls in an
      aligned grid (covered by a render test asserting the grid classes;
      confirmed live — two and three rows lined up cleanly in both
      themes); the single-row default still shows just the select and
      amount controls, Remove and "Fill remaining" both correctly absent
      (also covered by a render test).
- [x] "Fill remaining" sets its row to absorb the exact leftover and can
      never produce a total over the unallocated amount — guaranteed by
      construction (`left > 0` gates it, see the code comment on
      `fillRemaining`) and confirmed live: with two funded rows, clicking
      "Fill remaining" on one correctly computed `unallocated − the
      *other* row's amount`, not just the global leftover. Hidden in the
      default state is covered by a render test.
- [x] "Split evenly", the first-row Saving-goal preselect, the no-debt-
      payoff-preselect rule, and the existing over-assignment messaging
      all still work (covered by existing and updated tests; Split evenly
      also confirmed live).
- [x] Documentation updated (see Documentation).

## Technical notes
- **`src/components/AssignUnallocated.tsx`**: widen the local `Goal` type
  to carry `amountCents` (the page already passes `budget.goals`, a
  `GoalLine[]` that includes it — currently dropped by the narrower type).
  Category `Line` already has `amountCents`. Build the option label in
  each `<option>` as `` `${name} · ${formatMoney(amountCents, currency)}
  budgeted` `` for categories and `` `${name} · ${formatMoney(amountCents,
  currency)}` `` for goals. Add the summary line near the top (derived
  from the existing `total`/`left`/`unallocated` locals; no `aria-live` —
  the existing bottom footnote stays the sole live region). Change
  the row `<li>` from `flex flex-wrap items-center gap-2` to an aligned
  grid; keep the remove button only when `rows.length > 1`. Add a
  `fillRemaining(key)` helper that sets that row to
  `unallocated − Σ(other rows)` and wire it to a secondary button per row,
  rendered only when `left > 0`.
- **No changes to `src/app/income/page.tsx`, `src/lib/budgets.ts`,
  `src/lib/goals.ts`, `src/lib/plan.ts`, or any API route.** The panel's
  props already contain everything needed; `getBudget` already returns
  `categories` (`BudgetLine[]` with `amountCents`) and `goals`
  (`GoalLine[]` with `amountCents`).
- **Tests**: new `tests/assign-ui.test.tsx` — render `AssignUnallocated`
  with `renderToStaticMarkup` and assert the option-label formats, the
  default-state summary line, the grid classes, and that Remove/"Fill
  remaining" are correctly absent at the single-row default. This needs
  `next/navigation`'s `useRouter` mocked (`vi.mock("next/navigation", () =>
  ({ useRouter: () => ({ refresh: () => {} }) }))`) — outside the Next
  app-router runtime it throws "invariant expected app router to be
  mounted," which is why this component (and `BudgetEditor`/`GoalEditor`,
  which have the same `useRouter` call) had no render tests before this
  spec. The under/over summary states and clicking "Fill remaining" itself
  need a typed/clicked interaction this project's static-render Vitest
  setup can't simulate (no jsdom) — verified manually (see Verification);
  `tests/assign.test.ts` continues to cover the API path, unchanged.

## Decisions
- **Show current amounts in the option label, not beside the select.** A
  per-option "· $X" is visible at the moment of choice — which is the one
  place the information changes the decision — and costs no extra layout.
  A separate "currently $X" hint under the select would read the same but
  only after a choice is already made.
- **"Fill remaining" is per-row, not a global button.** A global
  "assign the rest" has to guess which target gets it; putting the action
  on each row makes the recipient explicit and keeps the existing
  one-target-per-row model intact.
- **Keep the panel where it is for now.** Moving it above the income
  sources would front-load "where it goes" before "what came in", which
  reads backwards on a page titled Income — and the summary bar's Assign
  button already anchors to `#assign` from every other Plan page. If the
  panel still feels buried after these changes, relocating it is a
  one-line follow-up, but it is deliberately not bundled here so the
  informed-split work lands cleanly on its own.
- **Current amounts are read-only here.** The panel assigns *additional*
  money from this month onward; showing the existing amount gives context
  but must not invite editing it, which belongs on Budget and Goals.
- **Only one `aria-live` region, not two.** The new top summary and the
  existing bottom footnote would otherwise say nearly the same thing on
  every keystroke, double-announcing it to screen reader users. The
  footnote already carries more (the over-limit wording, the effective-date
  framing), so it keeps the live role; the new line is a sighted-only
  visual convenience for keeping the numbers in view while choosing targets
  further up the panel.

## Documentation
- `README.md`: update the "Assign unallocated" bullet to mention that
  targets show their current amount and the panel offers a "Fill
  remaining" action.
- `CLAUDE.md`: update the Assign-unallocated bullet (spec 015) to note the
  panel now shows per-target current amounts and a "Fill remaining"
  action, still no API change.
- No change to `specs/015` — that spec's scope (relocating Assign to
  Income) is untouched by this one.

## Verification
`npm run dev`: open Income with unallocated money. Confirm each category
option shows its current amount and each goal option its amount; confirm
the "Assigning X of Y — Z left" line updates as you type and turns red
when you exceed the unallocated total; confirm a two-row split renders as
aligned columns and that "Fill remaining" on one row absorbs exactly the
leftover and disappears once nothing is left. Confirm "Split evenly" and
the first-row Saving-goal preselect still work, and that Debt payoff is
still never preselected. Check both themes and phone width. Run
`npm test`, `npm run lint`, and `npm run build` (e2e is paused — see Out
of scope).

**Done, on a real household's data (dev server, `feat/016-allocation-ux`)**:
option labels ("Groceries · $1,000.00 budgeted", "KT Brokerage · $300.00");
the summary line's equal/under/over states, including the danger color
switching together with the existing footnote; a two-row split rendering
aligned in both light and dark; "Fill remaining" on one of two funded rows
correctly computing `unallocated − the other row's amount` (not the global
leftover) and disappearing once nothing was left; "Split evenly" still
splitting correctly. **Not done this session**: phone width — the browser
tool's window resize didn't take effect on the captured screenshots (a
tool-side quirk, reproduced twice), so this still needs a manual check.
327 automated tests, lint, typecheck and `npm run build` all pass.
