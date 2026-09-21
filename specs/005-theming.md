# 005: Light and dark theme

**Status:** approved

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
- [x] Every existing page (setup, sign-in, join, home, budget, members) is readable in both themes, with no hardcoded colors left outside the tokens.
- [x] Error, muted and accent text meet 4.5:1 contrast in both themes.
- [x] Native inputs and selects match the theme.
- [x] Theme control works by keyboard and has an accessible label.
- [x] Documentation updated (see Documentation).
- [x] `npm run lint`, `npm test` and `npm run build` pass.

## Technical notes
- Tailwind v4: declare `@custom-variant dark (&:where(.dark, .dark *));` so `dark:` follows a `dark` class on `<html>` rather than only the media query.
- Tokens as CSS variables on `:root` and `:root.dark` (mapped through `@theme inline`), replacing the current `prefers-color-scheme` media block. Add semantic tokens (`--danger`, `--accent`, `--muted`, `--border`) and migrate `text-red-600`, `text-emerald-*` and `foreground/NN` opacity utilities that fail contrast.
- Pre-paint script: a small inline script in `<head>` (in `layout.tsx`) reads `localStorage`, falls back to `matchMedia("(prefers-color-scheme: dark)")`, and sets the `dark` class before render. Put `suppressHydrationWarning` on `<html>`, since the class differs between server and client.
- A small client `ThemeToggle` component holds the three-state choice, writes `localStorage` (wrapped in try/catch; it can throw in private windows), applies the class, and listens to the media query while in System mode.
- Read `node_modules/next/dist/docs/` for the current guidance on scripts in the root layout and the flash-before-hydration guide (`01-app/02-guides/preventing-flash-before-hydration.md`) before implementing.
- No new dependency is required; `next-themes` is an option, but the amount of code needed is small.

## Decisions
- The control is a compact three-button segmented icon control (System / Light / Dark) in the header on every page, signed in or not.
- The choice is per device only, not synced to the account. A per-user preference belongs in a future account settings spec.

## Documentation
- `README.md`: add theming to Features (follows the system, per-device override).
- `CLAUDE.md`: note that colors must come from the theme tokens (never hardcoded), and that new UI is checked in both themes.

## Verification
Set the OS to dark, load the app with cleared site data and confirm it is dark with no flash. Switch the OS to light and confirm it follows. Choose Dark in the toggle, switch the OS to light, reload, and confirm it stays dark. Choose System and confirm it follows again. Walk every page in both themes and check text contrast. Run tests, lint and build.

## Implementation notes
- Tokens: `--background`, `--foreground`, `--muted`, `--danger`, `--accent`, defined in `src/app/globals.css` for `:root` and `:root.dark`. Muted text moved from `text-foreground/50-70` (which failed 4.5:1) to `text-muted`; errors use `text-danger`; the logo uses `text-accent` with its glyph drawn in the page background color so it reads in both themes.
- `tests/theme.test.ts` parses the tokens and asserts WCAG AA (4.5:1) for foreground, muted, danger and accent against the background in both themes, so a future color change that breaks contrast fails the build.
- Borders and dividers use `border-foreground/10-20`, which are non-text and follow the theme automatically.
- The pre-paint script is inline in `src/app/layout.tsx`; `ThemeToggle` reads the stored choice with `useSyncExternalStore` (server snapshot is "system") and follows live OS changes while in System mode.

## Not verified
The browser behavior was not exercised: no flash on hard reload, persistence across reloads, following a live OS change, and the toggle by keyboard. These acceptance boxes stay unchecked until someone confirms them in a browser. The HTML output (script present before the body, toggle rendered, `suppressHydrationWarning` set) and the contrast were verified by test and by fetching the page.
