---
name: ship
description: Run the pre-commit gate, commit, push the branch and open a pull request. Stops at the PR; never merges.
disable-model-invocation: true
argument-hint: [PR title]
---

Ship the current work as a pull request. Title, if given: $ARGUMENTS

1. **Branch.** If on `main`, create `<type>/<short-name>` first (`feat/NNN-name` for a spec, else `fix/`, `docs/`, `chore/`).
2. **Gate.** Skip this step for a docs-only change.
   - `npm run lint` and `npx tsc --noEmit`
   - `npm test` (needs `docker compose up -d db`)
   - `npm run build`
   - UI change: `npm run test:e2e`. Auth or navigation change: `npm run test:e2e:docker` as well.

   If anything fails, stop and show the output. Don't commit around a failure.
3. **Spec bookkeeping**, when the branch implements a spec:
   - tick the acceptance boxes that are now true; say which are still open
   - make the docs changes its Documentation section lists
   - leave Status alone; `/land` sets `implemented`
4. **Commit** what belongs to this change, with the Co-Authored-By trailer. Leave unrelated files unstaged and say so.
5. **Push** with `git push -u origin <branch>` and open the PR with `gh pr create`.
   - Title: written like a commit subject, since squash-merge makes it the commit on `main` (`Spec 040: Notes on Goals`, `fix: …`, `docs: …`).
   - Body: a Summary (what changed and why) and a Test plan (what you ran, with results).
6. Report the PR URL and the gate results, then stop.
