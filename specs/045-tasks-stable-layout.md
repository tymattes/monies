# 045: Task cards keep their position when one expands

**Status:** implemented

## Goal
Spec 035 let four Task codes expand into an inline form instead of linking
out, and deliberately laid the cards out in a CSS multi-column grid
(`columns-1 sm:columns-2 lg:columns-3`) specifically so a tall expanded panel
would only push down the cards below it. In practice it doesn't: the browser
rebalances a multi-column layout's column breaks as the total content height
changes, so expanding one card can shift *other, unrelated* cards into a
different column entirely — not just push something down. The result is
confusing: after clicking to expand a task, it's not obvious which card you
just opened, because the whole board just reshuffled. This spec fixes the
actual cause (multi-column's rebalancing) by switching to a real CSS grid,
where every card keeps a fixed row/column slot for its lifetime, and adds a
clear visual highlight to whichever card is currently expanded so there's no
ambiguity even while its own row grows.

## Requirements
- **Task cards lay out in a CSS grid**, not CSS multi-column: one column on
  small screens, two from `sm`, three from `lg` — the same breakpoints spec
  035 already chose, just a layout mechanism that doesn't reshuffle.
- **Expanding a card only grows the height of the row it's in.** Cards in
  other rows never change position. A shorter card sharing a row with an
  expanded one keeps its own natural height — it does not stretch to match —
  so the row simply has empty space beside the short card, not a stretched
  one.
- **The expanded card gets a visible accent highlight** around its border,
  distinct from the existing severity color on its left edge, so it's
  unambiguous which card you opened regardless of anything else on the page.
  The highlight appears the moment it expands and disappears when it
  collapses.
- **Multiple cards can still be expanded at once** (unchanged from spec
  035); each gets its own highlight independently.
- **Everything else about spec 035 is unchanged**: which four codes are
  inlineable, their forms, `router.refresh()`-on-success behavior,
  editability gating, and accessibility (`aria-expanded`, the warning
  severity's spoken prefix).

## Out of scope
- Which task codes are inlineable, or any change to the four forms
  (`AssignUnallocated`, `TaskQuickExpense`, `TaskQuickBudgetAdjust`, the goal
  check-off button) — this is a container/layout fix only.
- The Plan summary's compact task chips (spec 033) — unaffected, same
  scoping spec 035 used; this only touches `TaskList.tsx`.
- Any change to `buildTasks`, `Task`, or `getOverview`'s shape.
- A "collapse others when one opens" behavior or a "collapse all" control —
  still explicitly out of scope, same as spec 035.
- Rendering the expanded panel as a floating overlay/popover instead of
  growing the grid in place, which would mean literally nothing on the page
  ever moves. Considered and rejected for now — see Decisions.

## Acceptance criteria
- [x] `TaskList`'s card list uses CSS grid classes (`grid grid-cols-1
      sm:grid-cols-2 lg:grid-cols-3`), not `columns-*`; no `break-inside-
      avoid` remains (a multi-column-only property, meaningless in a grid).
- [x] Expanding a card never moves a card in an earlier row, and a card
      sharing its row keeps its own exact size and position even as the row
      grows around it (`align-items: start`); only rows after the expanded
      one may shift down, which is expected — more content appeared above
      them (verified via bounding-box comparison before/after in an e2e
      test).
- [x] The expanded card's element carries a visible accent-colored highlight
      (e.g. `ring-2 ring-accent`) that is present only while it's open.
- [x] Multiple cards can be expanded simultaneously, each independently
      highlighted, matching spec 035's existing "expanding one does not
      close another."
- [x] Every existing spec 035 acceptance criterion still holds — no
      regression to which codes inline, their behavior, or editability
      gating (covered by the existing test suite continuing to pass).
- [x] `npm test`, `npm run test:e2e`, and `npm run lint` pass.
- [x] Documentation updated (see Documentation).

## Technical notes
- **`src/components/overview/TaskList.tsx`**: change the `<ul>`'s className
  from `columns-1 gap-3 sm:columns-2 lg:columns-3` to `grid grid-cols-1
  gap-3 sm:grid-cols-2 lg:grid-cols-3 items-start` (`items-start` keeps a
  shorter card at its own height instead of the grid's default `stretch`
  making it match its row's tallest neighbor). Remove `break-inside-avoid`
  from each `<li>` — grid items are never split across columns, so it has no
  effect and would be misleading to leave in. Replace the comment above the
  list (currently explaining the multi-column rationale) with one explaining
  why grid was chosen instead (see Decisions).
- Each `<li>`'s className gains a conditional highlight, layered via
  Tailwind's `ring` utility (box-shadow, so it doesn't collide with the
  existing `border`/`border-l-4` classes): `` open ? "ring-2 ring-accent" :
  "" ``, using the `open` boolean the component already derives from
  `expanded.has(key)` — no new state.
- No change to `expanded`/`checkingOff` state shape, props, the four inline
  render branches, or any API call — this is a container-styling change
  confined to the two className strings above.
- **Tests**: `tests/overview-ui.test.tsx`'s existing `TaskList` block gains
  an assertion that the list's class string contains `grid` and not
  `columns`. `e2e/overview.spec.ts` gains a case: seed enough tasks to fill
  more than one row, expand the *last* card (whichever row it's in, nothing
  can be after it to push down), and assert (a) the *first* card's
  `getBoundingClientRect()` is unchanged, (b) the expanded card's element
  has the accent ring class, and a collapsed sibling does not.

## Decisions
- **Why grid over multi-column, precisely**: `columns-N` lets the browser
  decide which items land in which column, and it recomputes that as content
  height changes — that recomputation, not "things push down," is the actual
  bug. A CSS grid assigns every card a fixed row and column the moment it's
  laid out; growing one card's content only grows the height of *its own
  grid row*, which can push later rows down (expected — more content
  appeared) but can never move a card sideways into a different column or
  swap two cards' relative positions.
- **Reading order changes from column-major to row-major, and that's a
  welcome side effect, not a compromise.** Multi-column fills top-to-bottom
  within a column before starting the next one (so card 2 sits below card 1,
  not beside it, in a 2-column layout); a grid fills left-to-right within a
  row before starting the next one (card 2 sits beside card 1). Row-major is
  the more natural scan order for a card layout and matches how every other
  grid in this app (the Income/Bills/Goals cards, the screenshot layouts)
  already reads.
- **Rejected: a floating overlay/popover for the expanded panel.** This
  would give true zero layout shift — nothing on the page would ever move,
  including rows below the expanded card. It's meaningfully more work
  (anchored positioning, edge-of-viewport handling, click-outside-to-close,
  and a different interaction feel than "grows in place," which spec 035
  chose deliberately so a task could be completed without feeling like a
  dialog took over the page) for a benefit — avoiding a small, expected
  downward push of later rows — that's much less confusing than the actual
  bug this spec fixes. Worth revisiting only if the grid fix still feels
  unclear in practice once it ships.
- **A `ring`, not a border-color change, for the highlight.** The card's
  left edge already carries meaning (the warning severity color, spec 032)
  and its outer border is the same neutral `border-border` every card in the
  app uses; changing that border's color to indicate "open" would clash with
  "this is a warning." A `ring` sits outside the existing border as its own
  visual layer, so "open" and "warning" never compete for the same pixels.

## Documentation
- `CLAUDE.md`: extend the "Tasks' inline actions (spec 035)" bullet with a
  clause noting the card list is a CSS grid (not multi-column, spec 045) so
  expanding one only grows its own row, plus the accent-ring highlight on
  the currently expanded card(s).
- `README.md`: no change — the Hub's feature description doesn't describe
  the layout mechanism, so there's nothing stale to correct.

## Verification
`npm run dev`: on the Hub with several tasks (enough to fill more than one
row at each breakpoint), expand a task and confirm cards in other rows don't
move, a shorter card sharing its row keeps its own height, and the expanded
card is clearly highlighted. Expand a second card and confirm both stay
highlighted and multiple can be open at once. Collapse one and confirm its
highlight disappears while the other stays open. Resize across the `sm`/`lg`
breakpoints and confirm the grid re-flows normally. Check both themes and
phone width. Run `npm test`, `npm run test:e2e`, `npm run lint`, and
`npm run build`.
