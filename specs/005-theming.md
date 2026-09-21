# 005: Light and dark theme

**Status:** draft

## Goal
Make light and dark mode a first-class part of the UI from the start, so every later screen (dashboards especially) is built against both themes. Supports `brief.md`: modern, rich UX.

## Requirements
- **Default follows the system.** With no saved choice, the app uses the OS/browser `prefers-color-scheme` and updates live if it changes.
- **Manual override.** A theme control in the header offers System, Light and Dark. Choosing Light or Dark overrides the system; choosing System clears the override.
- **Per device.** The choice is stored in the browser (`localStorage`), not on the account. Different devices in a household can differ, and nothing is asked at sign-up.
- **No flash.** The correct theme is applied before first paint, including on the sign-in, setup and join pages, so there is no light-to-dark flicker on load.
- **Both themes are designed, not inverted.** Colors come from tokens (background, foreground, and semantic ones for error text, success/accent, borders), each defined for light and dark, so pages do not hardcode colors. Text meets WCAG AA contrast (4.5:1) in both themes; error text currently uses one red that is weak on dark and gets a per-theme value.
- Tailwind's `dark:` variant follows the same setting (class-based on `<html>`), so component-level `dark:` styles agree with the tokens.
- `color-scheme` is set so native controls (inputs, selects, scrollbars) match the theme.
- The theme control is keyboard accessible and labelled, and shows the current mode.

## Out of scope
Per-account or per-household stored preference, custom color palettes or accent choices, scheduled (time-of-day) themes, high-contrast mode, chart palettes (part of the dashboards spec, which will build on these tokens).

## Acceptance criteria
- [ ] With no saved choice, the app matches the system theme and follows a live system change.
- [ ] Choosing Light or Dark persists across reloads and overrides the system; choosing System returns to following it.
- [ ] No visible flash of the wrong theme on a hard reload in either theme (checked on `/sign-in` and `/budget`).
- [ ] Every existing page (setup, sign-in, join, home, budget, members) is readable in both themes, with no hardcoded colors left outside the tokens.
- [ ] Error, muted and accent text meet 4.5:1 contrast in both themes.
- [ ] Native inputs and selects match the theme.
- [ ] Theme control works by keyboard and has an accessible label.
- [ ] Documentation updated (see Documentation).
- [ ] `npm run lint`, `npm test` and `npm run build` pass.

## Technical notes
- Tailwind v4: declare `@custom-variant dark (&:where(.dark, .dark *));` so `dark:` follows a `dark` class on `<html>` rather than only the media query.
- Tokens as CSS variables on `:root` and `:root.dark` (mapped through `@theme inline`), replacing the current `prefers-color-scheme` media block. Add semantic tokens (`--danger`, `--accent`, `--muted`, `--border`) and migrate `text-red-600`, `text-emerald-*` and `foreground/NN` opacity utilities that fail contrast.
- Pre-paint script: a small inline script in `<head>` (in `layout.tsx`) reads `localStorage`, falls back to `matchMedia("(prefers-color-scheme: dark)")`, and sets the `dark` class before render. Put `suppressHydrationWarning` on `<html>`, since the class differs between server and client.
- A small client `ThemeToggle` component holds the three-state choice, writes `localStorage` (wrapped in try/catch; it can throw in private windows), applies the class, and listens to the media query while in System mode.
- Read `node_modules/next/dist/docs/` for the current guidance on scripts in the root layout and the flash-before-hydration guide (`01-app/02-guides/preventing-flash-before-hydration.md`) before implementing.
- No new dependency is required; `next-themes` is an option, but the amount of code needed is small.

## Open questions
1. Toggle style: a three-way segmented control (System / Light / Dark) or a single cycling icon button? Recommendation: a compact menu-free segmented control on wide screens and the same control inside the header on mobile.
2. Should the choice ever sync to the account? Recommendation: no, per device only, for now.

## Documentation
- `README.md`: add theming to Features (follows the system, per-device override).
- `CLAUDE.md`: note that colors must come from the theme tokens (never hardcoded), and that new UI is checked in both themes.

## Verification
Set the OS to dark, load the app with cleared site data and confirm it is dark with no flash. Switch the OS to light and confirm it follows. Choose Dark in the toggle, switch the OS to light, reload, and confirm it stays dark. Choose System and confirm it follows again. Walk every page in both themes and check text contrast. Run tests, lint and build.
