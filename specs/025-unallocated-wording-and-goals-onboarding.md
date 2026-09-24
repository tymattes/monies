# 025: Unallocated wording and a goals step in the get-started checklist

**Status:** implemented

## Goal
Two small copy/onboarding gaps from the usability study
(`usability-study-report.md`, issues 2 and 5) where the UI contradicts the
app's own model:

- The Overview "Needs attention" item says "$X is not assigned to a category
  yet" and links to Assign, but since spec 020 Assign can only target goals and
  a category's budget is never touched by it. The message points at the wrong
  concept.
- The "Let's get your month set up" checklist covers income, budgets and bills
  but not goals, although goals are a core part of the Plan (`brief.md`,
  specs 014 and 015) and the only thing Assign can act on.

## Requirements
- The `unallocated` attention message no longer mentions categories. Proposed
  wording: `$X is still unallocated — assign it to a goal.` Code, severity,
  href, `actionLabel` ("Assign") and `amountCents` are unchanged (spec 015).
- `GetStarted` gains a fourth step linking to `/goals` (with the month query).
  Because every new household already has a default "Savings" goal (spec 014),
  the title is "Review your goals" rather than "Add your goals", with text such
  as "Saving or debt-payoff targets you check off each month once the money
  moves." Order: income, budgets, bills, goals.
- When `GetStarted` appears is unchanged (`src/app/page.tsx`: an editable month
  with no income, no budgeted amount and no bills). Goals deliberately do not
  count toward "empty", since the default goal would otherwise hide the
  checklist for every new household.

## Out of scope
- Renaming the Assign action or restructuring the panel (see spec 026).
- A guided first-run wizard or sample data (feature idea in the study; needs its
  own spec if wanted).
- Changing when `GetStarted` is shown.

## Acceptance criteria
- [x] The `unallocated` attention message uses the new wording and never says
      "category".
- [x] Existing assertions of the old string are updated: `tests/overview.test.ts`
      (lines ~274 and ~380), `tests/overview-ui.test.tsx` (~253), and
      `e2e/overview.spec.ts` (~128, ~201, ~206, which match on "is not assigned").
- [x] `GetStarted` renders four numbered steps including "Review your goals",
      linking to `/goals` with the month query preserved; the empty-household
      case in `e2e/overview.spec.ts` checks the new step.
- [x] Documentation updated (see Documentation).

## Technical notes
- `src/lib/overview.ts` (~line 193): message string only.
- `src/components/overview/GetStarted.tsx`: add an entry to `steps`; the numbered
  list already maps over the array.
- Euro/other-currency test in `overview.test.ts` uses `money()`; keep the amount
  formatting unchanged.

## Documentation
- `README.md`: no change unless it quotes the message or lists the checklist.
- `CLAUDE.md`: no change; the Overview bullet describes attention codes, not copy.

## Verification
`npm run dev` on a fresh household: the checklist shows four steps, the last
("Review your goals") linking to Goals. With unallocated income, the Needs attention item reads the
new text and "Assign" still lands on `/income#assign`. Run `npm test`,
`npm run lint`, and `npx playwright test e2e/overview.spec.ts`.
