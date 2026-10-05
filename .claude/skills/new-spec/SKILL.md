---
name: new-spec
description: Draft a numbered spec in specs/ from a feature idea, a usability note or a screenshot. Use when the user asks to draft, write or spec out a feature or behavior change. Drafts only; writes no feature code.
argument-hint: <the idea, one line or several>
---

Draft a spec for: $ARGUMENTS

If several ideas are given, write one spec per idea unless two of them can't ship separately.

1. Read `specs/brief.md`, `specs/_template.md` and the index in `specs/README.md`. Read the earlier specs that touch the same area, and the code they describe; a new spec must say which earlier decision it changes, by number.
2. Take the next unused number. Copy `specs/_template.md` to `specs/NNN-short-name.md` with Status `draft`.
3. Fill in every section:
   - **Goal**: the outcome, tied to `brief.md`.
   - **Requirements**: observable behavior, not implementation.
   - **Out of scope**: what a reader might assume is included and isn't.
   - **Acceptance criteria**: each one checkable by a test or by looking at the app.
   - **Technical notes**: data model, API shape, the files that change. Anything factual about a library or platform needs a cited source.
   - **Documentation**: what changes in `README.md`; name the `.claude/rules/` file if an area invariant changes, and `AGENTS.md` only if a rule that applies everywhere changes. "No change" is a valid answer.
   - **Verification**: the targeted test file, plus the e2e spec for UI changes.
4. Add a row to the index in `specs/README.md` with status `draft`.
5. Stop. Report the spec's path, the decisions you made on the user's behalf, and any open questions. Leave Status at `draft`; approval is the owner's call.
