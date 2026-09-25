# 040: Notes on Goals

**Status:** implemented

## Goal
A Goal today is just a name, type, target amount and checkmark (spec 014) —
there's nowhere to record *why* it exists or extra context ("Kids' 529,
contribute after bonus," "Payoff target: Feb 2027," "Ref# for the brokerage
transfer"). Households already do this for Bills via a free-text `note`
column (and `paidWith`); this spec gives Goals the same capability, scoped
to just a note (no `paidWith`-equivalent — goals aren't paid, they're
funded/checked).

## Requirements
- A goal gets an optional, editable `note`: free text, trimmed, capped at
  200 chars — same cap and trim behavior as Bills' `note` and Expenses'
  `description`.
- Editable from the Goals page's metadata editor (`GoalManager.tsx`),
  alongside the existing rename/type/reorder/archive controls. Name, type
  and note are drafted locally and committed together with one explicit
  **Save** button per row (enabled only while the row has unsaved
  changes), instead of each field auto-saving individually on blur/change
  — the original per-field auto-save (spec 040 v1) made it unclear whether
  an edit had actually been committed. Reordering (↑/↓) and Archive stay
  instant, unconfirmed-by-Save actions, since they're structural/list
  operations, not drafted text.
- Shown read-only in `GoalEditor`'s month-by-month checklist (`GoalEditor.tsx`,
  spec 014) as a small muted line under the goal's name, truncated to one
  line — the checklist is where a household actually works month to month,
  and a note like "auto-transfers the 3rd" is exactly the context that
  belongs there.
- Archived goals' collapsed summary line (`{name} · {TYPE_LABELS[type]}`)
  appends the note when present, matching Bills' `{name} · Paid with X ·
  note}` inline-summary convention.
- Any household member can set/clear a goal's note — same authorization as
  the rest of `GoalManager` (`requireHousehold` only, no owner restriction;
  spec 014).
- Clearing the field and saving removes the note (stored as `null`), not
  an empty string.

## Out of scope
- Setting a note at goal *creation* — the "Add goal" form stays
  name+type only; a note is added via the edit row afterward, same as
  today's flow for anything beyond the two required fields.
- Surfacing the note on the Hub's `GoalsCard` or in `PlanSummary`/Tasks —
  those stay dashboard-level figures; the note is checklist/editor
  context (`GoalEditor`, `GoalManager`), not a headline number.
- Rich text, attachments, or a note history — plain text, current value
  only, like every other free-text field in this app.
- A dedicated notes API endpoint — reuses the existing
  `PATCH /api/goals/[id]` metadata route.

## Acceptance criteria
- [x] `goals.note` column exists (nullable text), migration generated and
      committed under `drizzle/`.
- [x] `PATCH /api/goals/[id]` accepts an optional `note` field, validated
      with `parseLabel(body.note, "note", 200)` (not `parseNote` —
      `parseLabel` is the helper already used for Bills' `note`/`paidWith`
      because it distinguishes "not sent" from "clear it," which a PATCH
      endpoint needs and `parseNote`'s create-only semantics don't give).
- [x] `updateGoal`'s `GoalPatch` type includes `note?: string | null`, and
      `listGoals` (or wherever `GoalManager` gets its goal rows) returns
      `note` so the editor can show the current value.
- [x] `GoalManager.tsx`: each active goal row drafts name/type/note locally
      and commits them together via one **Save** button, `maxLength=200`
      on the note, placeholder "Add a note (optional)"; Save is disabled
      until the row has unsaved changes. Reorder (↑/↓) and Archive stay
      instant, matching pre-existing behavior.
- [x] `getGoalsMonth`'s `GoalLine` includes `note`, and `GoalEditor.tsx`
      shows it as a muted, truncated line under the goal's name when
      present.
- [x] Archived goals' summary line shows the note when present.
- [x] Clearing the note and saving persists `null`, not `""`.
- [x] `npm run lint`, `npm test`, `npm run build` pass; a Vitest case in
      `tests/goals.test.ts` covers set/clear/trim/200-char-cap on
      `updateGoal`, and UI cases (rendered via `renderToStaticMarkup`,
      matching this codebase's no-browser UI test convention) confirm the
      Save-button draft/commit behavior, the archived-summary rendering,
      and `GoalEditor`'s note line.
- [x] Documentation updated (see Documentation).

## Technical notes
- `src/db/schema.ts`: add `note: text("note")` to the `goals` table
  (alongside `name`/`type`, not `goalAmounts`/`goalCheckins` — it's
  metadata, not time-versioned or a presence record). Doc comment matches
  `expenses.description`'s: "Optional free-text detail about the goal.
  Trimmed and capped at 200 chars by the API; empty means none."
- `src/lib/goals.ts`: `GoalPatch` gains `note?: string | null`;
  `updateGoal`'s conditional `set` builder already handles "only touch
  fields present in the patch," so `note` slots in the same way `name`/
  `type` do. `listGoals`'s select needs `note` added to its returned shape.
- `src/app/api/goals/[id]/route.ts`: `PATCH` body parsing adds
  `note: parseLabel(body.note, "note", 200)`.
- `src/components/GoalManager.tsx`: `Goal` type gains `note: string | null`.
  A new `GoalRow` component replaces the old per-field `RenameInput`: it
  holds local `name`/`type`/`note` draft state plus a `saved` baseline set
  at mount and updated only after a successful save (not re-derived from
  the `goal` prop — same non-reactive-to-prop-drift pattern the old
  `RenameInput` already relied on, since `router.refresh()` updates the
  prop but the row isn't remounted). `dirty` compares drafts to `saved`;
  the row's Save button is `disabled={!dirty || saving}` and PATCHes only
  the fields that actually changed. Reorder/Archive call `patch()`
  directly, unchanged from before. Archived list's summary span appends
  `{g.note && ` · ${g.note}`}`.
- `src/lib/goals.ts`: `GoalLine` gains `note: string | null`;
  `getGoalsMonth`'s select adds `note: goals.note`.
- `src/components/GoalEditor.tsx`: local `Line` type gains
  `note: string | null`; the goal's `<label>` becomes a two-line stack
  (name, then `{l.note && <span className="block truncate text-xs
  text-muted">{l.note}</span>}`) instead of a single inline span, so the
  checkbox aligns to the top of a two-line label.
- No change to `GoalsCard.tsx` or `Overview`'s goals projection — see
  Out of scope.

## Documentation
`CLAUDE.md`'s Goals architecture bullet gets a short addendum noting the
optional `note` field, its 200-char cap via `parseLabel`, that it's edited
via an explicit Save button in `GoalManager` (not per-field auto-save), and
that it's shown read-only in `GoalEditor`'s checklist but not on the Hub's
`GoalsCard`. No `README.md` change — no new route, config, or top-level
feature, just a field on an existing one.

## Verification
- `npx vitest run tests/goals.test.ts tests/goals-ui.test.tsx`
- `npm run dev`, open `/goals`: edit a goal's name/type/note in
  `GoalManager` — Save stays disabled until something changes, then
  commits all three together; the same note shows read-only under the
  goal's name in the checklist above. Reload — everything persists. Clear
  the note and Save — it's gone (not showing as empty text). Archive a
  goal with a note — the archived summary line shows it.
- Confirm a second household member (non-owner) can also set/clear a note.
