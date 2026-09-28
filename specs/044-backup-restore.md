# 044: Backup and restore to a portable JSON file

**Status:** approved

## Goal
The README already documents a backup path — `pg_dump`/`pg_restore` against
the `monies-db` volume — and that stays the right disaster-recovery answer:
it's a complete, byte-for-byte copy, and it works today with no code changes.
This spec adds a second, application-level backup that a self-hoster reaches
for from inside the app itself rather than a shell: download the whole
household's data as a single JSON file, and restore from that file either
onto a fresh instance (moving to a new host) or back onto the same live
instance (undoing a mistake, or rolling back to a known-good point). It
exists for the cases `pg_dump` is awkward for — no Docker exec access, a
human-readable copy you can crack open and skim, a self-service undo that
doesn't need shell access to the server at all — not to replace it. The
brief's "simple to deploy and back up" is the throughline; this is the
low-friction half of that promise.

This spec also renames the **Members** tab to **Household** (`/members` →
`/household`), since backup and restore live there alongside the existing
member/invite management — "Household" better describes a page that now
covers the household as a whole, not just who's in it.

## Requirements
- **An owner can download a backup**: one action from the Household page
  produces a single JSON file containing everything that makes up the
  household — members, categories, budgets, bills, income, goals, and
  expenses, in full history (every time-versioned row, not just current
  values).
- **The same file restores two ways**, both producing an identical result —
  same members (able to sign in with their original password), same
  categories, same budget/bill/income/goal history, same logged expenses:
  - **Onto a fresh instance**: the setup screen (`/setup`) offers "Restore
    from a backup file" alongside "Create a new household," for an instance
    with no household yet.
  - **Onto the current instance**: the Household page offers "Restore from a
    backup file" to an owner, for a household that already exists. This
    **replaces everything** — every category, bill, income source, goal,
    expense, and member currently in the instance — with what's in the file.
    It is destructive to current data and requires typed confirmation (see
    Technical notes) before it runs.
- **The tab is renamed Members → Household**, at `/household` instead of
  `/members`; a request to the old `/members` path redirects to `/household`.
- **The file is self-describing and versioned**, so a backup made by one
  version of the app can be validated (and, if incompatible, clearly
  rejected) by another rather than partially importing and corrupting state.
- **Restoring is all-or-nothing.** An invalid or corrupt file fails before
  anything is written; there is no partially-restored instance, and a live
  restore's confirmation check happens before anything currently in the
  database is touched.

## Out of scope
- **Merging a backup into live data.** The live-restore path is a full
  replace, not a reconciliation — there is no per-row "keep this, take that"
  logic. Wanting to selectively bring back one deleted category or one past
  month's numbers without touching anything else is a different (harder)
  feature, worth its own spec if it comes up.
- **Scheduled/automatic backups.** This is a manual, on-demand download,
  same as `pg_dump` today. Automating it (a cron sidecar, a retention
  policy) is deployment-side and out of scope for the app itself.
- **Migrating a backup file across app versions with schema changes.**
  `schemaVersion` (see Technical notes) exists so this can be *detected* and
  refused with a clear error, not silently corrupted — but writing
  migrations for old backup files is future work, done if it's ever actually
  needed.
- **Encrypting the file.** It's a plain JSON file, like a `pg_dump`; treat it
  like one (see Decisions on why it contains password hashes and what that
  means for handling it).
- **Re-authentication before a live restore.** The typed household-name
  confirmation (Technical notes) is the only gate; there's no existing
  "re-enter your password" pattern elsewhere in this app to match, and
  adding one here would be new scope of its own.
- **Any change to the existing `pg_dump`/`pg_restore` documentation** —
  that stays as-is, as the complete/low-level option.

## Acceptance criteria
- [ ] `GET /api/backup` (owner-only) returns a JSON file (`Content-Disposition:
      attachment`, filename `monies-backup-<household-name-slug>-<date>.json`)
      containing the full shape described in Technical notes.
- [ ] `POST /api/restore` (unauthenticated, setup-only) accepts a JSON body
      in the exported shape, rejects with 409 if a household already exists,
      rejects with 400 on a `schemaVersion` it doesn't understand or a
      structurally invalid file, and otherwise recreates the household, its
      members (original email + working original password), and every
      category/budget/bill/income/goal/expense row inside one transaction.
- [ ] `POST /api/household/restore` (owner-only, live instance) accepts the
      same JSON body plus a `confirmHouseholdName` field that must exactly
      match the *current* household's name; on a mismatch it rejects with
      400 and touches nothing. On a match, it deletes every current
      household-scoped row and every current user account, then runs the
      same restore logic `POST /api/restore` uses. Same validation and
      all-or-nothing transaction guarantees as the setup-only path.
- [ ] A member restored from backup (either path) can sign in with their
      original password immediately after restore completes — nothing about
      their credential changes.
- [ ] After a live restore, every session that existed before it (including
      the owner's own, mid-request) is invalid — restoring deletes the
      current user rows, which cascades their sessions. The client redirects
      to `/sign-in` rather than assuming anyone stays signed in.
- [ ] All time-versioned history round-trips on both paths: every
      `budget_allocations`, `bill_versions`, `income_amounts`, and
      `goal_amounts` row (not just the current month's) survives a
      backup/restore cycle, so past months read exactly as they did before.
- [ ] `goal_checkins` and `expenses` (every logged expense, any past date)
      round-trip completely, on both paths.
- [ ] Archived categories/goals/income sources and ended bills round-trip
      with their archived state intact — restoring doesn't un-archive
      anything.
- [ ] A member's role (owner/member) round-trips; the "at least one owner"
      invariant holds automatically since it's copying a state that already
      satisfied it.
- [ ] The Household page (`/household`, renamed from Members/`/members`)
      shows "Download backup" for owners, and "Restore from a backup file"
      for owners, with the typed-confirmation step for the latter.
- [ ] `/members` redirects to `/household`; `HeaderNav`'s label reads
      "Household" and is current on `/household`.
- [ ] The setup screen (`/setup`) still shows "Restore from a backup file"
      as an alternative to the create-household form, only when no household
      exists yet.
- [ ] Restoring with a file from a different (but understood) `schemaVersion`
      still succeeds if the shape is otherwise compatible; restoring with a
      newer `schemaVersion` than the running app understands fails with a
      readable error naming the mismatch, not a stack trace.
- [ ] Documentation updated (see Documentation).

## Technical notes
- **`src/lib/backup.ts`** (new): `exportBackup(householdId): Promise<BackupFile>`
  and `restoreBackup(data: unknown, opts: { wipeExisting: boolean }): Promise<void>`.
  `wipeExisting` is the only difference between the two entry points — the
  validation and insert logic is identical either way.
- **File shape** (`BackupFile`), one JSON object, camelCase keys matching the
  API's existing field conventions (`amountCents`, ISO date strings for
  `date` columns, ISO 8601 for timestamps):
  ```
  {
    "schemaVersion": 1,
    "exportedAt": "2026-09-28T12:00:00.000Z",
    "appVersion": "0.1.0",
    "household": { "id", "name", "currency" },
    "members": [
      { "id", "name", "email", "emailVerified", "role", "passwordHash" }
    ],
    "categories": [{ "id", "name", "position", "startMonth", "archivedFrom" }],
    "budgetAllocations": [{ "id", "categoryId", "effectiveMonth", "amountCents", "createdBy" }],
    "goals": [{ "id", "name", "type", "note", "position", "startMonth", "archivedFrom" }],
    "goalAmounts": [{ "id", "goalId", "effectiveMonth", "amountCents", "createdBy" }],
    "goalCheckins": [{ "id", "goalId", "month", "checkedBy" }],
    "incomeSources": [{ "id", "memberId", "name", "kind", "startMonth", "archivedFrom" }],
    "incomeAmounts": [{ "id", "sourceId", "effectiveMonth", "amountCents", "createdBy" }],
    "incomeDeposits": [{ "id", "sourceId", "receivedOn", "amountCents", "note", "createdBy" }],
    "bills": [{ "id", "name", "paidBy", "note", "addedBy", "startMonth", "archivedFrom" }],
    "billVersions": [{ "id", "billId", "effectiveMonth", "amountCents", "intervalMonths", "categoryId", "createdBy" }],
    "expenses": [{ "id", "categoryId", "spentOn", "amountCents", "description", "addedBy" }]
  }
  ```
  `id` fields are the real table UUIDs (or the `user.id` text ID for
  members), reused as-is on restore — see Decisions on why IDs aren't
  remapped, and why that's safe even for the live-restore path.
  `createdAt`/`joinedAt`/timestamps other than `exportedAt` are intentionally
  omitted; they're provenance, not state, and restoring resets them to "now"
  naturally via each table's `defaultNow()`.
- **`passwordHash`** is `account.password` (the Better Auth credential hash,
  already opaque and salted) for the row where `providerId = 'credential'`.
  Nothing else from `account`/`session`/`verification` is exported.
- **`schemaVersion`** is a small integer this spec owns, independent of the
  Drizzle migration count — it only bumps when a future spec changes what
  this export/import shape needs to carry. `restoreBackup` rejects (400) any
  `schemaVersion` greater than the one this build knows how to read; `v1` is
  the only version this spec defines.
- **Export** (`GET /api/backup`, `route()`-wrapped, `requireHousehold(headers,
  { role: "owner" })`): one read-only query per table above, scoped to the
  household, assembled into the shape and returned with `Content-Type:
  application/json` and a `Content-Disposition: attachment` header. No
  pagination or streaming — same data-volume assumption the existing
  `pg_dump` already makes.
- **Restore, shared core** (`restoreBackup(data, { wipeExisting })`):
  1. Validate the body's shape defensively — it's an uploaded file, not
     trusted input, even though it's expected to be an unmodified export:
     `schemaVersion` is a known integer; every section is an array (or the
     expected object for `household`); every `amountCents` is a
     non-negative integer (`> 0` where the source table requires it); every
     date-shaped field matches `YYYY-MM-DD`; `household.currency` passes
     `isValidCurrency`; every foreign-key-shaped reference (`categoryId`,
     `goalId`, `sourceId`, `billId`, `memberId`/`createdBy`/`addedBy`/
     `paidBy`/`checkedBy`) points at an ID present in its parent section (or
     is null where the column allows it). Any failure is one `HttpError(400,
     …)` naming what's wrong, not a generic parse error.
  2. Inside one `getDb().transaction`:
     - If `wipeExisting`: delete the current `households` row (cascades
       away `categories`, `goals`, `incomeSources`, `bills`, and —
       transitively — `budgetAllocations`, `goalAmounts`, `goalCheckins`,
       `incomeAmounts`, `incomeDeposits`, `billVersions`, `expenses`, and
       `householdMembers`), then delete every remaining `user` row (this
       instance has exactly one household, so every existing user is a
       member of it; deleting `user` cascades `session` and `account` for
       each). If not `wipeExisting`: assert `isSetupNeeded()` still holds
       (belt-and-suspenders against a race with a concurrent setup).
     - Insert in FK order: `households` → `user` (one row per member) →
       `account` (the credential row, reusing `passwordHash` verbatim — no
       re-hashing) → `householdMembers` → `categories` → `goals` →
       `budgetAllocations` → `goalAmounts` → `goalCheckins` →
       `incomeSources` → `incomeAmounts` → `incomeDeposits` → `bills` →
       `billVersions` → `expenses`. IDs are inserted exactly as given.
  3. On any failure inside the transaction, the whole thing rolls back —
     for the setup path, the instance is still "needs setup"; for the live
     path, the pre-restore household is untouched (Postgres transaction
     rollback, not a manual undo).
  4. Returns `{ ok: true }` (201) with no session cookie on either path —
     restoring can bring back several members, there's no single "the user
     who just did this" the way `/api/setup` has one obvious owner to sign
     in. The client redirects to `/sign-in` and shows "Restore complete —
     sign in with any account from your backup."
- **`POST /api/restore`** (existing route, unauthenticated): `isSetupNeeded()`
  must be true, else `HttpError(409, "This instance is already set up")`;
  calls `restoreBackup(data, { wipeExisting: false })`.
- **`POST /api/household/restore`** (new route): `requireHousehold(headers,
  { role: "owner" })`; the body must include `confirmHouseholdName` equal
  (exact string match) to `ctx.household.name`, else `HttpError(400,
  "Type the household name to confirm")` — checked before the transaction
  even opens, so a wrong confirmation never touches the database. On a
  match, calls `restoreBackup(data, { wipeExisting: true })`.
- **`/members` → `/household` rename**: `src/app/members/` moves to
  `src/app/household/`; `src/app/members/page.tsx`'s content moves with it
  (component can be renamed `HouseholdPage` for clarity, existing
  sub-components `MemberActions`/`InviteManager`/`HouseholdNameForm` keep
  their names — they're still about members and the household name
  specifically). A small `src/app/members/page.tsx` stub (or a `redirects()`
  entry in `next.config.ts`) sends `/members` to `/household` permanently.
  `HeaderNav`'s destination list changes `{ href: "/members", label:
  "Members" }` to `{ href: "/household", label: "Household" }`; the "four
  top-level destinations" invariant (Overview, Plan, Expenses, Household)
  is otherwise unchanged.
- **`src/app/setup/page.tsx`**: gains a second path alongside the existing
  `CredentialsForm` (`mode="setup"`) — **`RestoreForm.tsx`** (new client
  component: a file `<input type="file" accept="application/json">`, reads
  it client-side with `.text()` + `JSON.parse`, `POST`s the parsed object via
  the existing `api()` helper, redirects with `navigateTo("/sign-in")` on
  success). A toggle ("Restore from a backup file instead") switches between
  the two forms, same single-card pattern `AuthCard` already uses.
- **Household page** (`src/app/household/page.tsx`): a new
  **`BackupSection.tsx`** (owner-only, same `isOwner` gate
  `HouseholdNameForm` already uses) with two parts: a plain `<a
  href="/api/backup" download>` styled as a button (no client JS needed for
  the download itself), and `RestoreForm` reused with a `mode="overwrite"`
  variant — same file input as the setup screen, plus a text input the user
  must type the current household's name into before the submit button
  enables, posting to `/api/household/restore` instead of `/api/restore`.
  The section's copy states plainly what it does ("Replaces every category,
  bill, goal, income source, and expense in this household, and every
  member's account, with what's in the file. This cannot be undone from
  inside the app.").
- **Tests**: new `tests/backup.test.ts` — export shape and round-trip on
  both the empty-instance and live-overwrite paths (export a seeded
  household with history in every table, restore it both ways, assert every
  table matches); restore rejection when a household already exists
  (setup path) and when the confirmation name doesn't match (live path);
  restore rejection on a bad `schemaVersion`, a malformed date, a negative
  amount, and a dangling foreign-key reference (both paths, shared
  validation); sign-in with the restored password succeeds after either
  path; a live restore invalidates the acting owner's own session. A small
  `tests/household-ui.test.tsx` (renamed from/added alongside the existing
  Members UI test) for the toggle on `/setup` and the confirmation-gated
  form on `/household`, plus a redirect test for `/members` → `/household`.

## Decisions
- **IDs are preserved exactly, not regenerated, on both paths.** The
  live-restore path wipes everything before inserting, so the table is
  empty at insert time exactly like the fresh-instance case — there's never
  a live row to collide with. Reusing the original UUIDs keeps restore a
  straightforward "insert every row as given" rather than needing an
  ID-remapping pass across a dozen FK relationships, on either path.
- **Live restore is a full wipe, not a merge, and that's a deliberate
  scope line.** A real merge would need conflict resolution for every
  time-versioned table this app has (whose budget wins for a month that
  exists in both?); a full replace has one unambiguous outcome instead,
  matching how the setup-path restore already behaves. It's more
  destructive, but destructive-and-predictable beats a merge with silent
  judgment calls.
- **Typed household-name confirmation, not a re-auth or a second click.**
  This codebase doesn't have a "re-enter your password" pattern anywhere
  else to extend, and a plain confirm button is too easy to click through
  for an action this destructive (replaces every member's login, not just
  data). Typing the household's own name is the same friction level GitHub
  and similar tools use for "delete everything," and it doubles as a sanity
  check that the owner is restoring into the household they think they are.
- **No "back up before you restore" enforcement.** The UI copy can suggest
  downloading a fresh backup first, but the app doesn't require or
  auto-create one — that would be a safety net worth having but is a
  separate, smaller feature (and the existing `pg_dump` already covers
  "I want an out" for anyone who's set it up as a cron job).
- **The file includes password hashes, not plaintext, and that's still a
  real sensitivity worth naming.** A restore that didn't include credentials
  would recreate every member's financial history but lock everyone out of
  it. Better Auth's hash is salted and one-way, so the file is no more
  dangerous than the `account` table rows the existing `pg_dump` already
  captures wholesale. The README's backup guidance gets a line making this
  explicit so people don't treat the JSON file more casually than they'd
  treat a database dump.
- **Members → Household rename, with a redirect.** Backup/restore broadens
  this page beyond "who's in the household" to "the household as a whole,"
  so the old name stops fitting. A redirect from `/members` keeps any
  existing bookmark or link working rather than silently 404ing.
- **No streaming, no pagination, no compression.** A household's full
  history is small; matching the existing `pg_dump` assumption keeps this
  spec from solving a problem this app doesn't have.
- **Exact `schemaVersion` match, no forward migration logic.** Writing a
  migration path for a format that has exactly one version so far would be
  speculative. The version field exists precisely so this can be added
  later without a breaking change to `v1` files; until then, a version
  mismatch fails loudly and specifically rather than trying to guess.

## Documentation
- `README.md`: a new "Backup and restore" subsection alongside the existing
  `pg_dump`/`pg_restore` one — framed as "also, from inside the app" rather
  than a replacement, describing the Household page's download and restore
  (including that restore there replaces everything) and the setup screen's
  restore option, and the note that the file contains password hashes and
  should be handled like the existing database dump. Update the Navigation
  feature description and any other README mention of "Members" to
  "Household." Add a Features bullet (spec 044) describing the rename and
  both restore paths.
- `CLAUDE.md`: rename the Navigation bullet's "Members" destination to
  "Household" (`/household`, redirect from `/members`); add a new invariant
  bullet under Architecture — the `BackupFile` shape, `schemaVersion`'s
  purpose, the two restore entry points and what distinguishes them
  (`wipeExisting`), the typed-confirmation gate on the live path, and that
  IDs/password hashes round-trip verbatim while timestamps don't.

## Verification
Seed a household with a full month of history (income, budgets, bills,
goals with a checked-off month, some expenses, a second member) via
`npm run dev`. Download the backup from the Household page as the owner,
inspect the JSON.

**Fresh-instance path**: spin up a second, empty instance, open `/setup`,
choose "Restore from a backup file," upload it. Confirm both members can
sign in with their original passwords, and Budget/Bills/Income/Goals/Expenses
all match the original, including a past month. Try restoring the same file
again against an already-set-up instance and confirm it's refused.

**Live-instance path**: on the original instance, change something (add an
expense, rename a category) so current state differs from the backup. From
the Household page, start a restore with the original file; confirm the
submit button stays disabled until the household's exact name is typed, and
that typing the wrong name is rejected without touching data. Confirm it,
and confirm the browser ends up signed out and redirected to `/sign-in`; sign
back in as a restored member and confirm the change you made before
restoring is gone and everything else matches the backup.

Hand-corrupt one field in the file (e.g. a negative `amountCents`) and
confirm both restore paths fail cleanly with no partial data written or
replaced. Confirm `/members` redirects to `/household` and `HeaderNav`
reads "Household." Run `npm test`, `npm run test:e2e`, `npm run lint`, and
`npm run build`.
