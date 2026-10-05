---
name: land
description: Merge an approved pull request, mark its spec implemented, clean up branches and redeploy the local Docker stack.
disable-model-invocation: true
argument-hint: [PR number]
---

Land PR $ARGUMENTS (default: the PR for the current branch). Running this skill is the owner's go-ahead to merge that one PR.

1. **Find it.** `gh pr view <n> --json number,title,state,headRefName,mergeStateStatus`. Stop if it's not open, or if the working tree has uncommitted changes.
2. **Mark the spec implemented**, when the PR implements one (`feat/NNN-…`, or it touches `specs/NNN-*.md`):
   - If an acceptance box is still unchecked, stop and report it.
   - Set Status to `implemented` in the spec file and in its row of the `specs/README.md` index.
   - Commit as `docs: mark spec NNN implemented` and push.
3. **Wait for CI.** `gh pr checks <n> --watch`. On a failure, stop and show it.
4. **Merge.** `gh pr merge <n> --squash --delete-branch`. The ruleset on `main` is squash-only; never `--merge` or `--rebase`. If the only thing blocking is the code-owner review on the maintainer's own PR, rerun with `--admin`. GitHub only accepts that from a repository admin, so access control decides who can land. In auto mode the admin merge also needs `Bash(gh pr merge:*)` allowed in the maintainer's own `.claude/settings.local.json` (git-ignored); if it is denied, stop and say so.
5. **Clean up.**
   - `git checkout main && git pull --ff-only && git fetch --prune`
   - Delete the local branch with `git branch -D <branch>`. A squash merge leaves it looking unmerged, so `-d` refuses; `-D` is safe once `gh pr view <n>` says `MERGED`.
   - List any other local branch whose remote is gone. Delete the ones whose PR is merged; report the rest and leave them.
6. **Redeploy.** If `docker compose ps` shows the stack running, follow the `redeploy` skill. If not, skip it and say so.
7. Report: the merge commit, the spec's status, branches deleted, and the health check result.
