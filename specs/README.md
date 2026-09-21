# Specs

Monies is built spec-first. `brief.md` is the source of truth for product intent; every feature or change gets its own numbered spec before any code is written.

## Workflow

1. Copy `_template.md` to `NNN-short-name.md` (next unused number) and set Status to `draft`.
2. Fill it in and review it. Once agreed, set Status to `approved`.
3. Implement against the acceptance criteria. Keep the spec updated if scope changes.
4. When every acceptance box is checked and verification passes, set Status to `implemented`.

## Index

| # | Spec | Status |
| --- | --- | --- |
| 001 | [App shell](001-app-shell.md) | implemented |
