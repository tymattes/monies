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
  alongside the existing rename/type/reorder/archive controls, using the
  same blur-to-save convention as the existing rename field
  (`RenameInput`). Given the row is already dense (name, type select, ↑/↓,
  Archive), the note input sits on its own line under the row rather than
  competing for horizontal space.
- Archived goals' collapsed summary line (`{name} · {TYPE_LABELS[type]}`)
  appends the note when present, matching Bills' `{name} · Paid with X ·
  note}` inline-summary convention.
- Any household member can set/clear a goal's note — same authorization as
  the rest of `GoalManager` (`requireHousehold` only, no owner restriction;
  spec 014).
- Clearing the field (blur with empty text) removes the note (stored as
  `null`), not an empty string.

## Out of scope
- Setting a note at goal *creation* — the "Add goal" form stays
  name+type only; a note is added via the edit row afterward, same as
  today's flow for anything beyond the two required fields.
- Surfacing the note anywhere read-only goals appear outside
  `GoalManager` — the Hub's `GoalsCard`, `GoalEditor`'s month-by-month
  amount/checkoff view, and `PlanSummary`/Tasks stay unchanged. A goal's
  note is editor-only context, not a dashboard figure.
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
- [x] `GoalManager.tsx`: each active goal row has a note input (blur-to-save,
      `maxLength=200`, placeholder "Add a note (optional)") on its own line
      under the existing controls; saving follows the same `patch()` /
      `router.refresh()` convention as rename/type/position/archive.
- [x] Archived goals' summary line shows the note when present.
- [x] Clearing the input persists `null`, not `""`.
- [x] `npm run lint`, `npm test`, `npm run build` pass; a Vitest case in
      `tests/goals.test.ts` covers set/clear/trim/200-char-cap on
      `updateGoal`, and a UI case (rendered via `renderToStaticMarkup`,
      matching this codebase's no-browser UI test convention) confirms the
      note input and archived-summary rendering.
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
  New `NoteInput` component mirrors `RenameInput` (controlled value, blur
  commits via `onSave`, Enter blurs) but full-width and capped at 200 vs
  60. Active `<li>` becomes a two-line layout: existing `flex flex-wrap`
  controls row, then the note input below it. Archived list's summary
  span appends `{g.note && ` · ${g.note}`}`.
- No change to `getGoalsMonth`, `GoalEditor.tsx`, `GoalsCard.tsx`, or
  `Overview`'s goals projection — see Out of scope.

## Documentation
`CLAUDE.md`'s Goals architecture bullet gets a short addendum noting the
optional `note` field, its 200-char cap via `parseLabel`, and that it's
editable only from `GoalManager` (not surfaced on the Hub or in
`GoalEditor`). No `README.md` change — no new route, config, or top-level
feature, just a field on an existing one.

## Verification
- `npx vitest run tests/goals.test.ts`
- `npm run dev`, open `/goals`, add a note to a goal, reload — the note
  persists. Clear it — it's gone (not showing as empty text). Archive a
  goal with a note — the archived summary line shows it.
- Confirm a second household member (non-owner) can also set/clear a note.
