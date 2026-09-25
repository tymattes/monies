# 041: Support multiple owners

**Status:** implemented

## Goal
Today exactly one person can ever be `owner` — the household creator — and
there's no way to add another (spec 003 explicitly put "ownership transfer"
and "per-member permissions beyond owner/member" out of scope). A household
with two adults managing money together has no way to give the second
person full control: they're stuck as a `member` forever, unable to invite
or remove people, rename the household, or edit anyone else's income.

This spec lets an owner grant another existing member full owner rights —
call it "admin," but functionally it's just becoming a second (or third...)
owner — and revoke it later. `household_members.role` is already
`"owner" | "member"` and `removeMember` already defends against removing
the *last* owner (a defensive check that's never been reachable, since
there's never been a second owner to begin with) — the data model already
expected this; only the "grant" action itself was missing.

## Requirements
- An owner can promote any other member to `owner`, and demote any owner
  (including themselves) back to `member`, from the Members page
  (`/members`).
- The only rule: the *last* remaining owner can never be demoted (mirrors
  the existing "last owner cannot be removed/leave" rule in `removeMember`,
  applied to role changes too, not just removal).
- A promoted owner can do **everything** the original owner can — there is
  no new "admin" tier with a reduced permission set. Every existing
  `role === "owner"` check in the codebase (invites, household settings,
  removing members, editing any member's income sources) already applies
  to whichever rows currently have `role = "owner"`, so promoting a member
  requires no change to any of those checks — only a way to create the
  second `owner` row.
- Confirmed via a dialog before promoting ("They'll be able to do
  everything you can...") and before demoting ("They'll no longer be able
  to..."), matching the weight `Archive`/`Remove`/`Leave` already get
  elsewhere in this app.
- Only an owner can change anyone's role (including their own) — a member
  has no self-service path to owner.

## Out of scope
- A distinct "admin" role with different permissions than `owner` — see
  Requirements: this is full owner parity, so it reuses the existing
  `owner` role value rather than adding a third enum member that every
  `role === "owner"` check in the codebase would need to learn about.
- Inviting someone directly as an owner — invites still always create
  `member`s (`src/lib/invites.ts`); promote them afterward from the
  Members page, same as any other role change.
- Any per-member permission granularity finer than owner/member (e.g. "can
  invite but not remove," "can edit budgets but not income") — still out
  of scope per spec 003, unchanged here.
- Audit log of who promoted/demoted whom, or role-change notifications.

## Acceptance criteria
- [x] `PATCH /api/members/[userId]` accepts `{ role: "owner" | "member" }`,
      owner-only (`requireHousehold(headers, { role: "owner" })`).
- [x] Demoting the last remaining owner returns 409 ("The last owner cannot
      be demoted"), mirroring `removeMember`'s existing "cannot be removed
      or leave" message and status code.
- [x] Promoting a member, or demoting a non-last owner, returns 204 and the
      change is immediately visible in `GET /api/members`.
- [x] A member (non-owner) gets 403 attempting to change any role,
      including their own.
- [x] Members page: each row an owner-viewer sees gets a "Make owner" (on
      a member row) or "Remove owner" (on an owner row) button, confirmed
      via `window.confirm`, using the same busy/error pattern
      `MemberActions` already has for Remove/Leave. A member-viewer sees
      neither button (same gating as today's Remove button).
- [x] A newly promoted owner immediately gains access to owner-only
      actions with no other code change required: inviting/revoking
      invites, renaming the household, removing other members, editing
      any member's income sources.
- [x] `npm run lint`, `npm test`, `npm run build` pass; Vitest cases cover
      promote, demote, the last-owner guard, and the 403 for non-owners
      (in `tests/households.test.ts`, alongside the existing member tests
      it already has).
- [x] Documentation updated (see Documentation).

## Technical notes
- `src/lib/household.ts`: export `ROLES: Role[] = ["owner", "member"]`
  (same shape as `GOAL_TYPES` in `goalTypes.ts`) for `parseRole` to
  validate against.
- `src/lib/validate.ts`: `parseRole(value: unknown): Role` — required (not
  optional-on-patch like `parseGoalType`), since this route's whole body is
  just `{ role }`.
- `src/lib/members.ts`: new `updateMemberRole(ctx, targetUserId, role)`.
  Row-locks the target (`.for("update")`, same as `removeMember`), 404 if
  not found. If the target is currently `owner` and the new role is
  `member`, counts current owners in the same transaction and throws 409
  if it's 1. Otherwise updates `householdMembers.role`. No self/other
  distinction needed in the guard itself — demoting yourself when you're
  the last owner hits the same owner-count check as demoting anyone else.
- `src/app/api/members/[userId]/route.ts`: new `PATCH` handler —
  `requireHousehold(headers, { role: "owner" })`, `parseRole(body.role)`,
  `updateMemberRole`, 204. (Unlike `DELETE` on this route, there's no
  self-exception to gate around: only owners may call this at all.)
- `src/components/MemberActions.tsx`: gains `role: Role` and
  `canChangeRole: boolean` (true when the *viewer* is an owner — same
  input `MembersPage` already computes as `isOwner` for `canRemove`) props,
  and a second button alongside Remove/Leave: label toggles between "Make
  owner" and "Remove owner" based on the target's current `role`. No
  client-side last-owner pre-check/disable — same as today's Remove/Leave
  buttons, which also don't pre-check and instead surface the server's 409
  through the existing inline error paragraph.
- `src/app/members/page.tsx`: pass `role={m.role}` and
  `canChangeRole={isOwner}` to `MemberActions`.
- No change anywhere else — every other `role === "owner"` check
  (`income.ts`, `invites` routes, `household` route) is already
  role-value-based, not identity-based, so a second owner row is
  automatically covered.

## Documentation
`CLAUDE.md`'s Authorization bullet gets a short addendum: households can
have more than one `owner`; `PATCH /api/members/[userId]` is how one is
promoted/demoted, guarded by the same "last owner" rule `removeMember`
already enforces. `README.md`: no change — no new route surface beyond an
existing resource's PATCH verb, no new config or deploy concern.

## Verification
- `npx vitest run tests/households.test.ts`
- `npm run dev`: as the owner, promote a second member to owner from
  `/members`, confirm the dialog copy, sign in as them, confirm they can
  invite/rename/remove/edit others' income. Demote them back; confirm they
  immediately lose those actions. Attempt to demote the sole owner (in a
  single-owner household) and confirm the 409 surfaces as an inline error.
