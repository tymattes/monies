# 043: Bills "Paid with" becomes a household member

**Status:** implemented

## Goal
On Bills, the "Paid with (optional)" field is a free-text input backed by a
`<datalist>` of previously-typed values (`paidWithOptions`). In a
household-first app with multiple members — where income is already
per-member — "who pays this bill" should reference a real household member,
not an arbitrary string. This makes the field a member picker and stores the
member reference on the bill. Found in the usability study
(`usability-study-report.md`, observation 4): the datalist is wrong for
multi-member households and can't survive a member rename or removal.

## Requirements
- **"Paid with" is a member picker, not free text.** On the Bills page (add and
  edit forms) the field becomes a select of the household's current members
  with a "—" (none) option, since the field stays optional.
- **The bill stores who pays it as a member reference.** A new nullable
  `paid_by` column on `bills` references `user`, replacing the free-text
  `paid_with` string.
- **Removed members degrade to no payer, not to "Former member".** `paid_by`
  uses `ON DELETE SET NULL`, same mechanism as `added_by`, but unlike
  `added_by` (always set at creation) `paid_by` is optional from the start —
  "—" (none) is a normal, common state. Once the FK is nulled by the removal,
  there is no way to tell "never had a payer" from "payer was removed" apart,
  so a removed payer's bill just reads as if no payer had ever been chosen
  (the "Paid with …" caption is omitted, same as today's `{bill.paidWith &&
  ...}` behavior) rather than showing a "Former member" label.
- **The API validates the member belongs to the household.** A non-member or
  malformed id is a 400, not a silent foreign-key error.
- **Rendering shows the member's current name.** The bill row and the "Paid
  with" caption read from the joined user's name, so a rename stays correct
  everywhere it appears.

## Out of scope
- Per-member totals or "who paid" filtering on the Hub/Budget — this only
  changes how the field is entered and stored, not any rollup.
- Changing `added_by` (who entered the bill) — it already references a member.
- Migrating any existing free-text `paid_with` values to members (see
  Decisions).

## Acceptance criteria
- [x] On Bills, the add form's "Paid with" control is a member select
      (including a none option); typing is no longer possible.
- [x] The edit form's "Paid with" is the same member select, prefilled with the
      bill's current payer.
- [x] A bill's row and edit form show the payer's current name; after that
      member is removed, it shows no payer, the same as if none had been
      chosen (not "Former member" — see Decisions).
- [x] Submitting a non-member or malformed `paidBy` id returns a 400.
- [x] `tests/bills.test.ts` (and any other test asserting `paidWith` /
      `paidWithOptions`) is updated and passes.
- [x] Documentation updated (see Documentation).

## Technical notes

Data model (`src/db/schema.ts`, `bills` table around line 383):
- Drop `paidWith: text("paid_with")`; add
  `paidBy: text("paid_by").references(() => user.id, { onDelete: "set null" })`
  — mirroring `addedBy` a few lines below.
- Generate the migration with `npm run db:generate`; the committed SQL lives in
  `drizzle/`. Migrations apply automatically at server start
  (`src/instrumentation.ts`).

Library (`src/lib/bills.ts`):
- `BillItem`: replace `paidWith: string | null` with `paidById: string | null`
  and a display name `paidBy: string | null` (null id → `null`, not "Former
  member" — a null `paid_by` is indistinguishable from "no payer chosen" once
  a member is removed, unlike `added_by` which is always set at creation), by
  joining `user` on `b.paid_by` in `activeBills` exactly as `added_by` is
  joined today (line 75).
- `BillsMonth`: remove `paidWithOptions: string[]`; the distinct-`paid_with`
  query (lines 122–126) goes away.
- `createBill` / `updateBill`: accept `paidBy: string | null` in place of
  `paidWith`. Validation that the id is a household member belongs here (or in
  a shared helper), not in the route.

Validation: add a small `assertMember(ctx, userId)` helper (or inline check)
against `householdMembers` (`src/lib/members.ts` already exports
`listMembers`; there's no single-member check yet). Reuse for both create and
update.

API (`src/app/api/bills/route.ts` and `src/app/api/bills/items/[id]/route.ts`):
- `POST` reads `paidBy` (userId or null) instead of `paidWith` via a new
  `parseMemberId` validator (`src/lib/validate.ts`, shape-only; membership is
  the DB-backed `assertMember` check in `bills.ts`); a present-but-invalid id
  throws 400.
- The items route's PATCH (labels: `name`/`paidWith`/`note`) swaps `paidWith`
  for `paidBy`.

Page/component:
- `src/app/bills/page.tsx`: fetch `listMembers(ctx.household.id)` alongside the
  existing three queries and pass `members` (id + name) into `BillsView`.
- `src/components/BillsView.tsx`: replace the paidWith `<datalist>` input in
  `AddBillForm` (around line 200) and in `BillRow`'s edit form (around line
  372) with a `CategorySelect`-style member `<select>`; keep the "Paid with
  (optional)" label and the none option. The display caption (line 423) reads
  the member name when `paidBy` is non-null and is omitted entirely when null
  (`{bill.paidBy && ...}`, same shape as today's `{bill.paidWith && ...}`).
  Remove the `paidWithOptions` prop and `list`/`<datalist>`.

## Decisions
- **Replace, don't keep both.** `paid_with` is dropped rather than kept as a
  free-text fallback. Two ways to say "who pays" would be redundant, and the
  member reference is the correct model. Existing free-text values are
  discarded — the field is unversioned and optional, there's no reliable
  name→member mapping, and this is early development.
- **`paid_by` mirrors `added_by`'s `ON DELETE SET NULL` mechanism, but not its
  "Former member" display.** `added_by` is always set at creation, so a null
  there unambiguously means "removed." `paid_by` is optional from the start,
  so a null there is ambiguous between "never chosen" and "removed" — it
  degrades to no payer shown, not a "Former member" label.
- **Scope is entry + storage only.** No per-member rollups or filters; that's a
  separate brief item (per-member views) and would inflate this change.

## Documentation
- `README.md` (Features → Bills): "Paid with" is a household-member picker, not
  free text; a removed payer reverts to no payer shown (same as none chosen).
- `CLAUDE.md` (Bills bullet in Architecture): note `bills.paid_by` references a
  household member with `ON DELETE SET NULL`.

## Verification
- [x] `npm run db:generate` produces the migration (two files, since a same-table
      add + drop of a text column is ambiguous to drizzle-kit's interactive
      rename prompt: `0010_bills_paid_by.sql` adds `paid_by`,
      `0011_bills_drop_paid_with.sql` drops `paid_with`); `npm run db:migrate`
      applies both cleanly against the dev DB.
- [x] `npm test` (382 passed, including the updated `tests/bills.test.ts`),
      `npx tsc --noEmit`, `npm run lint`, `npm run build` — all clean.
- [x] `npm run test:e2e` — the Bills e2e seed now sets `paidBy` to the owner's
      id instead of `paidWith`; a new e2e test in `bills.spec.ts` confirms
      choosing a payer from the picker round-trips onto the bill row
      (`npx playwright test e2e/bills.spec.ts`: 6/6 passed). Full suite: 126
      passed, 7 failed — confirmed pre-existing and unrelated by re-running the
      same 7 against a clean `main` checkout with its own scratch database
      (identical failures there: a stale "Plan▾" hint expectation from spec
      037, stale cash-flow wording expectations, a pre-existing Members
      phone-width overflow, and flaky `waitForResponse` timeouts). None
      reference bills, paidWith or paidBy.
- [x] Manual: verified via `tests/bills.test.ts`'s "a removed payer's bill shows
      no payer, not 'Former member'" case (add with a payer, remove that
      member, re-fetch, payer fields go to `null`) and the e2e round-trip test
      above.
