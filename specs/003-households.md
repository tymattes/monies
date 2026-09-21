# 003: Households and members

**Status:** implemented

## Goal
Introduce the household as the root scope for all later data, plus the people in it. After this spec a person can create an account, set up a household, and invite others to join it. Supports `brief.md`: household first, household model with setup and invites, API-first for a future iOS app.

## Requirements

### Identity
- A **user** signs in with email and password, using Better Auth. Sessions are cookie-based for the web app; the auth setup must also allow bearer tokens later for iOS.
- First run: with no users in the database, the app shows a setup flow that creates the first user and the instance's household.
- Self-hosted: no email service is required. Sign-up is always closed; the only way to get an account after setup is an invite. There is no open-registration option.

### Households
- One household per instance. The setup flow creates it, and creating a second one is rejected (enforced in the database, not only in code).
- A household has a name and a creation time. It still gets its own table and id so later tables can reference it as the root scope.
- Every user belongs to that household. Membership lives in its own table with a role.
- Roles: `owner` and `member`. The creator is `owner`. Owners can invite, remove members and rename the household; members can view.
- Every household-scoped API route requires a signed-in member of the household and rejects everyone else.

### Invites
- An owner generates an invite link (single use, expires after 7 days, revocable). The link is copyable in the UI; no email sending.
- Opening the link lets a new person create an account and join the household directly.
- Owners see pending invites and can revoke them.

### Members
- Members page lists household members with role and join date.
- Owners can remove a member (not themselves while they are the only owner). A removed user's sessions are invalidated.
- A member can leave the household unless they are the last owner.

### API
- All behavior sits behind route handlers in `src/app/api/`, returning JSON, so the future iOS app can reuse it. UI pages call these routes.

## Out of scope
Multiple households per instance or per user, open registration, ownership transfer, password reset by email, social/SSO login, email delivery of invites, per-member permissions beyond owner/member, budgets, accounts, income, receipts, dashboards.

## Acceptance criteria
- [x] Fresh database: visiting the app leads to setup, which creates the first user and household and signs them in.
- [x] Signed-out visitors are redirected to sign-in; `/api/health` stays public.
- [x] Owner can create an invite link; a new person can use it once to create an account and join.
- [x] Expired, used or revoked invite links are rejected with a clear message.
- [x] Members page lists members; owner can remove one and that person's session stops working.
- [x] A second household cannot be created (database constraint), and household-scoped API routes reject signed-out users and non-members (covered by tests).
- [x] Passwords are stored hashed; no secrets committed; `.env.example` and README config table updated for new variables.
- [x] Migration adds tables and is idempotent on restart.
- [x] `CLAUDE.md` and README updated (architecture, auth, tech stack).
- [x] `npm run lint` and `npm run build` pass.

## Technical notes
- Tables (proposal): `users` (id, email unique, password_hash, name), `households` (id, name), `household_members` (household_id, user_id, role, joined_at), `invites` (id, household_id, token_hash, created_by, expires_at, used_at, revoked_at), plus session storage.
- Use UUID primary keys. Store only a hash of invite tokens.
- Auth: Better Auth with its Drizzle adapter (decided), so there is no hand-rolled password or session code. Better Auth owns its own user, session and account tables, so `users` above is its table; `household_members` references it.
- Route handler: `src/app/api/auth/[...all]/route.ts` exporting `toNextJsHandler(auth)`; server-side session via `auth.api.getSession({ headers: await headers() })`. Implementation forwards the `Set-Cookie` headers from `auth.api.signInEmail({ asResponse: true })` itself instead of using the `nextCookies()` plugin, since sign-in happens inside our own route handlers. [Next.js integration](https://www.better-auth.com/docs/integrations/next)
- Route protection: the installed Next.js is 16.3.5, so use `proxy.ts` (not `middleware.ts`). The Better Auth docs say cookie-only checks (`getSessionCookie()`) are for optimistic redirects and recommend real checks in each page/route, which is what `requireHousehold()` does. Confirm `proxy.ts` conventions in `node_modules/next/dist/docs/` before writing it. [Next.js integration](https://www.better-auth.com/docs/integrations/next)
- Drizzle: `drizzleAdapter(db, { provider: "pg" })` from `@better-auth/drizzle-adapter`. The auth tables are written by hand in `src/db/schema.ts` to match Better Auth's core schema (the CLI was not used), and the test suite exercises sign-in through the adapter to prove they line up. Migrations come from `npm run db:generate` and apply through `instrumentation.ts`. [Drizzle adapter](https://www.better-auth.com/docs/adapters/drizzle)
- Invite-only sign-up: set `emailAndPassword.disableSignUp` to `true` (default `false`). The first user and invitees are created through our own server-side code that validates the setup state or invite token. Resolved during implementation: `disableSignUp` only blocks the `/sign-up/email` endpoint (verified in `better-auth` source), so setup and invite-accept create the user and credential rows directly in one Drizzle transaction, hashing with Better Auth's own `$context.password.hash`, then sign in through `auth.api.signInEmail`. [Options reference](https://www.better-auth.com/docs/reference/options)
- Passwords: hashed with scrypt by default, which meets the "stored hashed" criterion. Skip `requireEmailVerification` and password-reset emails, since there is no email service. [Email & password](https://www.better-auth.com/docs/authentication/email-password)
- iOS later: the `bearer` plugin returns a session token in a response header after sign-in and accepts it as `Authorization: Bearer`. The docs call it intended for clients that can't use cookies and mention no refresh logic, so revisit token lifetime when the iOS spec is written. Not needed for this spec, and adding the plugin can wait. [Bearer plugin](https://www.better-auth.com/docs/plugins/bearer)
- Organization plugin considered and rejected: it offers organizations, owner/member roles and invitations, but invitations require a `sendInvitationEmail` function and can only be accepted by an already signed-in user. Neither fits an email-less, invite-link-first-signup flow, and it is built for multiple organizations. We keep our own `households`, `household_members` and `invites` tables. [Organization plugin](https://www.better-auth.com/docs/plugins/organization)
- Single-household enforcement: a `singleton` boolean column on `households` that is unique and checked to be true.
- Add a small `requireHousehold()` helper that every household-scoped route handler calls, so the session and membership check lives in one place.
- Introduces the first test runner, Vitest, documented in `CLAUDE.md`.
- Read `node_modules/next/dist/docs/` before writing route handlers or middleware/proxy code, since this Next.js version has breaking changes.

## Decisions
- Better Auth for authentication.
- One household per instance, since Monies is self-hosted.
- Closed sign-up with invite links only, no open-registration flag. Open registration on an instance with a single shared household would let any stranger who finds the URL join the household and see its finances.

## Verification
Fresh `docker compose up --build`: complete setup, create an invite, join in a private window as a second user, confirm both appear on the members page, remove the second user and confirm their session is rejected. Run tests, lint and build.

## Implementation notes
- Better Auth ids are text, so `household_members.user_id` and `invites.created_by` are text; our own tables use UUIDs.
- Removing a member or leaving deletes the user row (sessions, credential and membership cascade). Later specs that reference users should use `ON DELETE SET NULL` or soft-delete.
- Invite tokens are shown once at creation; the pending list shows created/expiry dates only, since only a hash is stored.
- Tests (`npm test`) are integration tests that call the route handlers directly against a `monies_test` database.

## Not verified
The browser UI (forms, redirects, copy button) was not exercised in a real browser; the JSON API flow was checked against the Docker Compose stack with curl and by the test suite.
