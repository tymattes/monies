# 037: Header nav polish — accent underline, bigger touch targets, a Plan hint

**Status:** implemented

## Goal
The top bar (`HeaderNav.tsx`) is the app's primary navigation but currently
under-signals itself next to `PlanTabs`, which already uses an accent
underline for its active tab. This spec brings the top bar in line with that
established pattern, gives its links real touch targets on phone, and gives
"Plan" a small hint that it opens onto four sub-sections — all visual
polish, no new destinations or behavior.

## Requirements
- **Active-state underline**: `HeaderNav` marks the active destination with
  the same treatment `PlanTabs` uses — a 2px `border-accent` underline plus
  `font-medium text-foreground` — instead of color/weight alone. "Plan" is
  underlined for all four `PLAN_PATHS`, matching its existing `active` logic.
- **Touch targets**: each nav link gets horizontal and vertical padding
  (matching `PlanTabs`' `px-3 py-2`) instead of being bare text separated by
  gap only, so the tap target is comfortable on phone width.
- **Plan hint**: the "Plan" label carries a small trailing indicator (a
  `▾` character, `aria-hidden`, `text-muted`) signaling it opens onto
  sub-sections, since clicking it always lands on `/income` with no other
  cue that Budget/Bills/Goals live underneath.
- **Phone grouping**: on the wrapped second row (phone width, `HeaderNav`'s
  `order-last` row in `Header.tsx`), the nav row gets a `border-t
  border-border` separating it from the logo/controls row above, so the two
  rows read as distinct instead of a plain wrap.

## Out of scope
- No new nav destinations, no sidebar, no bottom tab bar (see prior
  discussion — sticking with the single top bar for now).
- No change to `PlanTabs` itself — it's already the reference pattern this
  spec copies.
- No change to which routes are "active" for which label.

## Acceptance criteria
- [x] Active destination in `HeaderNav` shows a `border-accent` underline,
      matching `PlanTabs`' visual treatment.
- [x] Nav links have `px-3 py-2` touch targets.
- [x] "Plan" shows a small `▾` hint, `aria-hidden`.
- [x] Phone-width wrapped nav row has a top border separating it from the
      logo/controls row.
- [x] `npx vitest run tests/theme.test.ts` and `tests/plan-ui.test.tsx` still
      pass (no hardcoded colors, contrast intact).
- [x] Checked in both light and dark theme, desktop and phone width.
- [x] Documentation updated (see Documentation).

## Technical notes
- Pure CSS/markup change in `src/components/HeaderNav.tsx` and
  `src/components/Header.tsx`. No new tokens needed — `border-accent` and
  `border-border` already exist in `globals.css` and are already used by
  `PlanTabs`.
- `border-accent` is a border color, not text, so it isn't subject to the
  WCAG text-contrast check in `tests/theme.test.ts`; the active label's text
  stays `text-foreground`, which is already checked.
- The `▾` hint is static (not conditional on active state) — it marks "Plan"
  as a section every time, not just when you're in it.

## Documentation
No feature-level change to document in `README.md` (still four destinations,
same routes). `CLAUDE.md`'s `HeaderNav` line in Architecture gets a short
addendum noting the accent-underline active state and the Plan hint, so the
description of that component stays accurate.

## Verification
- `npm run dev`, click through all four destinations at desktop width and at
  phone width (resize or device toolbar), in both light and dark theme.
  Confirm: active tab shows the accent underline, tap targets feel roomy on
  phone, "Plan" shows the `▾` hint, and the phone-width nav row has a visible
  top border separating it from the row above.
- `npx vitest run tests/theme.test.ts tests/plan-ui.test.tsx`
