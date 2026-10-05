@AGENTS.md

# Claude Code

- Area rules in `.claude/rules/` load on their own when you touch a matching path; don't read them all up front.
- Project skills (`.claude/skills/`): `/new-spec` drafts a spec, `/review-spec` checks one is ready to build, `/pr` gates and opens the PR, `/land` merges and cleans up, `/redeploy` rebuilds the local Docker stack.
- One spec per session. The spec file is the handoff, so start a fresh session (`/clear`) for the next spec instead of carrying this one's context along.
