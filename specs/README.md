# Specs

Monies is built spec-first. `brief.md` is the source of truth for product intent; every feature or change gets its own numbered spec before any code is written.

## Workflow

1. Copy `_template.md` to `NNN-short-name.md` (next unused number) and set Status to `draft`.
2. Fill it in and review it. Once agreed, set Status to `approved`.
3. Implement against the acceptance criteria. Keep the spec updated if scope changes.
4. Update the docs in the same PR: `README.md` (features, config, commands, deploy notes, tech stack) and `CLAUDE.md`. Each spec lists what changes under its Documentation section.
5. When every acceptance box, including docs, is checked and verification passes, set Status to `implemented`.
6. Deliver each spec on its own feature branch (e.g. `feat/003-households`) via a pull request; never commit directly to `main`.

## Index

| # | Spec | Status |
| --- | --- | --- |
| 001 | [App shell](001-app-shell.md) | implemented |
| 002 | [Database foundation and README](002-database-and-readme.md) | implemented |
| 003 | [Households and members](003-households.md) | implemented |
| 004 | [Categories and monthly budgets](004-categories-and-budgets.md) | implemented |
| 005 | [Light and dark theme](005-theming.md) | implemented |
| 006 | [Income per member](006-income.md) | implemented |
| 007 | [Bills, assign-to-savings, Dracula theme](007-bills-and-budget-polish.md) | implemented |
| 008 | [Overview page and grouped Plan area](008-overview-and-plan.md) | implemented |
| 009 | [Browser testing with Playwright](009-browser-testing.md) | implemented |
| 010 | [Provisional income for months in progress](010-provisional-income.md) | implemented |
| 011 | [UI polish: separate the panes and tables](011-ui-polish.md) | approved |
