# 027: Expense description belongs inside the entry form

**Status:** implemented

## Goal
On Expenses, the optional Description field sits below the "Add expense" button
and outside the `<form>` element (`ExpenseLog.tsx`). Pressing Enter in it does
not submit the entry, and it reads as detached from the expense it describes
(`usability-study-report.md`, issue 6). Quick single-line logging is the point of spec 019;
the form should behave as one unit.

## Requirements
- The Description input is inside the `<form>`, so Enter in any field submits.
- Layout keeps the quick-entry row (category, amount, date, Add expense) intact;
  Description sits on its own row inside the form above or beside the button
  such that the button is the last control in tab order.
- Validation, status text (`aria-live="polite"`), clearing of fields after a
  successful add, and the 200-character cap are unchanged.

## Out of scope
- Editing expenses (still delete-only, spec 019).
- Any API or schema change.

## Acceptance criteria
- [x] Description is a descendant of the `<form onSubmit={add}>`.
- [x] Enter in the Description field submits the expense; a missing category or
      amount shows the existing validation.
- [x] Tab order is Category, Amount, Date, Description, Add expense.
- [x] Reads cleanly in both themes and at phone width (theme tokens throughout,
      `flex flex-wrap` row).
- [x] A render test asserts the field is inside the form (`ExpenseLog` calls
      `useRouter`, so the test mocks `next/navigation` as
      `tests/assign-ui.test.tsx` does).
- [x] Documentation updated (see Documentation).

## Technical notes
- `src/components/ExpenseLog.tsx`: move the description block inside the form,
  reflow classes (`min-w-48 flex-1` on the wrapper is the likely fit). Remember
  `inputCls` includes `w-full`; overrides need the important suffix.

## Documentation
- `README.md` and `CLAUDE.md`: no change.

## Verification
`npm run dev`: on Expenses, type a category, amount and description, press Enter
in the description, and confirm the expense is added and the fields clear.
Run `npm test`, `npm run lint`.
