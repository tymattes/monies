---
paths:
  - "src/lib/backup.ts"
  - "src/app/api/{backup,restore}/**"
  - "src/app/api/household/restore/**"
  - "src/components/{BackupSection,RestoreForm,SetupChoice}.tsx"
  - "src/db/schema.ts"
  - "tests/backup.test.ts"
---

# Backup and restore

- Backup and restore (`src/lib/backup.ts`, spec 044): `exportBackup(householdId)` reads every table scoped to the household — members (with `account`'s credential-provider `password` hash, never plaintext), categories, `budgetAllocations`, goals, `goalAmounts`, `goalCheckins`, `incomeSources`, `incomeAmounts`, `incomeDeposits`, bills, `billVersions`, `expenses` — into one `BackupFile` JSON object (camelCase, matching the API's own field conventions). `restoreBackup(data, { wipeExisting })` defensively re-validates the whole thing (it's an uploaded file, not trusted input) before inserting anything, and preserves every row's original UUID rather than remapping IDs — safe because the target is always empty at insert time, either because it never had a household (`wipeExisting: false`, `POST /api/restore`, gated on `isSetupNeeded()` like `POST /api/setup`) or because everything was just deleted (`wipeExisting: true`, `POST /api/household/restore`, owner-only, gated on typing the current household's exact name in the request before the transaction opens). The wipe explicitly deletes every table in FK order rather than deleting only `households` and relying on cascade — `bill_versions.categoryId` has no cascade (by design, so `updateCategory` can block archiving a category with active bills), so a single `households` delete can violate that constraint depending on Postgres's internal cascade ordering. `schemaVersion` is this feature's own version counter (currently `1`), independent of the Drizzle migration count; a file from a newer schema version than the running build understands is rejected before anything is touched. Timestamps (`createdAt`, `joinedAt`, etc.) are not part of the file — they reset to "now" via each table's `defaultNow()` on restore, unlike IDs and password hashes which round-trip verbatim. A live restore deletes the current members' `user` rows, which cascades their sessions — the acting owner's own session is invalid immediately after, so the client redirects to `/sign-in` rather than assuming anyone stays signed in.
