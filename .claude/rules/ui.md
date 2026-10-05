---
paths:
  - "src/components/**"
  - "src/app/**/*.tsx"
  - "src/app/globals.css"
  - "src/lib/{client,themeScript}.ts"
  - "tests/theme.test.ts"
  - "e2e/{theme,a11y,error-page}.spec.ts"
---

# UI rules

- Visual identity (owner-approved): purple / cream / green. Dark is Dracula, light is Alucard. Green is the brand accent (`--accent`, focus rings). Use the tokens only, never hardcoded colors or translucent overlays. Icons live in `src/app/` (the M from `Logo.tsx`).
- Surface layers (spec 011): `--page` → `--background` (cards) → `--surface-subtle` (table headers) → `--surface` (totals). A card is `cardCls` from `src/components/ui.ts`; add `overflow-hidden` for lists/tables so fills follow the corners. Never put `text-danger` on `--surface`/`--surface-subtle` (below 4.5:1 in dark), so no row hover fills.
- Theming: colors come from the tokens in `src/app/globals.css` (`text-muted`, `text-danger`, `text-accent`, `bg-background`, `bg-surface`, `border-border`, `border-border-strong`). `tests/theme.test.ts` enforces WCAG AA contrast and fails on hardcoded colors. `dark:` follows the `dark` class on `<html>`, set before paint by the inline script in `layout.tsx`. Check new UI in both themes. Theme choice is per device (`localStorage`).
- Charts are hand-built and server-rendered (no chart library): stacked/bullet bars in CSS using `--chart-1..4`, always with a text equivalent, never color alone.
- Styling gotcha: `inputCls` includes `w-full`, so a width override on an input must use the important suffix (`w-32!`, `w-auto!`).
- Session changes need a full page load: after sign-in, setup, join, sign-out or leaving the household, use `navigateTo(path)` from `src/lib/client.ts` (`window.location.assign`), never `router.push()` + `router.refresh()` (they race; the header is server-rendered from the session). `router.refresh()` alone is only for data changes that keep the same user.
- Error pages: `src/app/error.tsx` and `src/app/global-error.tsx` replace Next's defaults. They show a digest reference matching Next's server log line, never the error text. Sign-in, setup and join screens use `AuthCard`.
