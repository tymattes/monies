# Security

## Reporting a vulnerability

If you find a security issue in Monies, please report it privately rather than
opening a public issue. Use GitHub's private vulnerability reporting
(**Security** tab → **Report a vulnerability**), and I'll coordinate a fix and
release before anything is disclosed publicly.

Please do not open a public issue or PR describing a vulnerability before it
has been fixed.

## Security model

Monies is a self-hosted app: you run it on your own server, and your data
stays there.

- **No public sign-up.** Accounts are only created by the first-run setup
  (the owner) and by accepting a single-use invite link. There is no open
  registration.
- **One household per instance.** Every budget, member, and transaction is
  scoped to the single household created at setup.
- **Email + password auth via Better Auth**, with cookie sessions. No email is
  sent, and no third-party auth provider is involved.
- **No connection to your bank.** Monies is deliberately disconnected from
  financial institutions — you enter figures by hand, so no bank credentials
  or transaction data ever leave your control.

## Running securely

Two secrets must be set before the app will start (see `.env.example`):

- `POSTGRES_PASSWORD` — the database password. Generate a strong one.
- `BETTER_AUTH_SECRET` — signs sessions. Generate with
  `openssl rand -base64 32` and keep it stable; changing it signs everyone
  out.

For anything beyond your LAN, put a reverse proxy with TLS in front of the
app port. The `db` container's port is bound to `127.0.0.1` only, so Postgres
is not reachable from outside the host.
