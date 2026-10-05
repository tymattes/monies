---
paths:
  - "src/lib/{auth,accounts,household,members,invites,setup}.ts"
  - "src/proxy.ts"
  - "src/app/api/{auth,members,invites,join,setup,household}/**"
  - "src/app/{sign-in,setup,join,household,members}/**"
  - "tests/{households,members-ui,credentials-form-ui}.test.*"
  - "e2e/signin.spec.ts"
---

# Auth, membership and roles

- Auth: Better Auth (`src/lib/auth.ts`, lazy `getAuth()`), mounted at `/api/auth/[...all]`. Public sign-up is disabled; accounts are only created by `src/lib/accounts.ts` (`insertUserWithPassword`) from first-run setup and invite accept. One household per instance (unique constraint on `households.singleton`). `baseURL` comes from `BETTER_AUTH_URL`; the optional `BETTER_AUTH_TRUSTED_ORIGINS` (comma-separated) adds more addresses Better Auth accepts sign-in requests from (e.g. a LAN IP alongside a Tailscale address) without changing which one `baseURL`-derived links use.
- Multiple owners: A household can have more than one `owner` (spec 041): `PATCH /api/members/[userId]` (`updateMemberRole` in `src/lib/members.ts`) lets any owner promote a member to owner or demote an owner back to member, own role included, guarded by the same "the last owner can never lose it" rule `removeMember` already enforces for removal/leaving. A promoted owner has full parity — every `role === "owner"` check elsewhere (invites, household settings, income source access) is role-value-based, not identity-based, so it needs no changes.
