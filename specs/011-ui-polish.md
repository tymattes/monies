# 011: UI polish: separate the panes and tables

**Status:** approved

## Goal
Panels (the Overview's cards, the Plan pages' lists and forms) and tables currently blend into the page and into each other, in both themes. Cards use the same color as the page background and are outlined only by a 1px border that is about 1.5:1 against it; tables have no header fill, dividers as faint as the outline, and rows that read as one flat block. This spec gives the interface a clear layering so each pane and table reads as its own object, without adding noise.

Supports `brief.md`: modern, mobile-first UX.

## Research
- **Dracula's specification defines layered backgrounds** for exactly this: the main `#282A36`, a darker `#21222C`, and lighter variants `#343746` and `#424450`, described as being for panels, sidebars and floating or layered elements, and Alucard has a matching graduated set (main `#FFFBEB`, with `#DEDCCF`, `#ECE9DF`, `#EFEDDC` and darker variants) ([Dracula specification](https://draculatheme.com/spec)). The specification's approach is to create hierarchy through progressive background shading rather than relying only on borders or shadows.
- **Dark themes express elevation with lighter surfaces, not shadows.** Material Design says shadows are less effective on dark backgrounds, so raised surfaces are made lighter, by an overlay that grows with elevation ([Dark theme, Material Design](https://m2.material.io/design/color/dark-theme.html)).

## Requirements

### A layered surface system (both themes)
- **Page** (new `--page` token): the canvas behind everything. Dark uses Dracula's Darker `#21222C`; light uses a slightly deeper cream `#F2EFE4`, derived from Alucard.
- **Card** (the existing `--background`, `bg-background`): the main color, raised above the page. Dark `#282A36`, light `#FFFBEB`. Every panel, list, table, form and empty-state box is a card: rounded (`rounded-xl`), one consistent border and, in light, a soft shadow (`shadow-sm`).
- **Subtle** (new `--surface-subtle`, `bg-surface-subtle`): table header rows and other quiet fills inside a card. Dark `#343746` (Dracula Light), light `#F7F4E8`.
- **Surface** (existing `--surface`): emphasis rows such as totals. Dark `#424450` (Dracula Lighter), light `#EBE8DC`.
- **Borders:** light dividers and outlines are darkened slightly so they are visible against a card (`#D3CDB0`); dark keeps `#44475A`, which reads against both the card and the deeper page.
- The header is a card-colored bar with its bottom border, sitting above the darker page.

### Cards
- Overview: Needs attention items, Cash flow, Categories, Income, Bills, and the get-started guide.
- Plan pages: the summary bar, the Budget table and Assign panel, the category manager lists, the Bills add form, lists and empty state, the Income member sections, and the totals banners.
- Members page: the members and invites lists. Sign-in, setup and join forms sit in a card.
- Charts (bars) sit on the card color, as before.

### Tables and lists
- Header rows use the subtle fill, with a divider under them; total rows use the surface fill and a divider above.
- Row dividers are clearly visible but quiet, and rows have comfortable, consistent padding.
- No hover fill on rows: Dracula red on lighter fills falls below 4.5:1, and rows contain red text when a category is over budget.

### Colors
- The light error red is nudged from Alucard's `#CB3A2A` to `#C8371F` so error text stays at 4.5:1 or better on the new, slightly deeper light page (Alucard's red is 4.37:1 there). This is a deliberate deviation from the palette, recorded in `globals.css`.
- Text tokens (foreground, muted, danger, accent) must meet 4.5:1 on the page and card; foreground, muted and accent on the subtle and surface fills. The theme test enforces all of it, plus that the card is distinguishable from the page and the border from both.

## Out of scope
New components or layout changes, typography changes, animation, changing colors beyond the surface system and the one red adjustment, row hover states, and any change to spacing between sections.

## Acceptance criteria
- [ ] The theme tokens exist for both themes (`--page`, `--surface-subtle`, updated `--surface`, `--border`, light `--danger`), are mapped into Tailwind, and pass the contrast tests.
- [ ] In both themes the card color differs from the page color and the border is distinguishable from both (asserted in the theme test and in the browser).
- [ ] Every panel, list, table, form and empty state listed above uses the card style.
- [ ] Table headers use the subtle fill and totals use the surface fill on the Overview and the Budget page.
- [ ] The header sits above the page; the page background is the deeper color on every page, including sign-in.
- [ ] The axe scans pass on every page in both themes at both sizes, and the phone layout tests pass.
- [ ] Screenshots for every page in both themes at desktop and phone size were reviewed.
- [ ] Documentation updated; `npm run lint`, `npm test`, `npm run build` and `npm run test:e2e` pass.

## Technical notes
- New tokens go in `globals.css` (`:root` and `:root.dark`) and into the `@theme inline` block as `--color-page` and `--color-surface-subtle`; `body` and `html` use `var(--page)`. Update `tests/theme.test.ts` (token set, contrast on page and subtle, card versus page, border visibility) and the palette expectations.
- Cards are the classes `rounded-xl border border-border bg-background shadow-sm`, exported as `cardCls` from `ui.ts` for new code; lists and tables add `overflow-hidden` so header fills follow the rounded corners.
- Browser tests: body background is the page color and cards are the card color (constants in `e2e/support/page.ts`); add a check that a card differs from the page.

## Decisions
- Layer with the official Dracula backgrounds in dark and derived Alucard-based tones in light, instead of heavier borders or shadows.
- No row hover fill, to keep red text at AA contrast.

## Documentation
- `CLAUDE.md`: the surface system (page, card, subtle, surface), the card classes, and where red text may sit.
- `README.md`: nothing user-facing beyond the look.

## Verification
Look at every page in both themes and at phone width: panels should read as raised cards on a deeper page, tables should have a distinct header and a distinct total row, and nothing should look heavier or noisier than before. Run the tests, lint, build and browser suite.
