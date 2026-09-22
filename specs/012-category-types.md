# 012: Category types (spending, saving, debt payoff)

**Status:** implemented, then superseded by spec 014

**Superseded:** spec 014 moved Saving and Debt payoff out of `categories`
entirely, into their own `goals` tables — a category's `type` column
(added here) no longer exists. Categories are Expense-only again. The
*concepts* introduced here (grouping the Budget page and Overview by kind,
Assign preselecting the first Saving-ish target) survive, just re-homed to
goals; see spec 014 for the current behavior and the reasoning for the
split.

## Goal
Today every category is treated as spending, including "Savings" — it is a
plain category that the Assign-unallocated panel happens to recognize by
matching its name. That breaks the moment a household wants more than one
savings vehicle (Roth IRA, brokerage, a child's account) or a debt-payoff
line (credit card, loan), and it means the Budget page and Overview lump
saving and debt paydown in with grocery money as if they were the same kind
of spend. This spec adds a `type` to categories — **spending**, **saving**,
or **debt payoff** — so the app can group and reason about them separately,
and removes the name-matching heuristic in favor of the real thing.

## Requirements
- **Category type.** Every category has a `type`: `spending` (default),
  `saving`, or `debt payoff`. Set on creation, changeable at any time (like
  the name — not time-versioned; it reclassifies the category going forward
  and in the past alike, since it is a label, not a monetary amount).
- **Starter categories.** The seeded "Savings" category is created with type
  `saving`. All other starters stay `spending`.
- **Category manager (`/budget` categories section).** The add-category form
  and each existing row get a type selector (Spending / Saving / Debt
  payoff). Archived categories show their type too.
- **Budget page.** Category rows are grouped into up to three sections —
  Spending, Saving, Debt payoff — in that order, each with its own
  subtotal, using the existing position order within each group. A group
  with no categories is omitted. The overall Budgeted total, Unallocated,
  and every existing figure are unchanged (still summed across all types).
- **Assign-unallocated panel.** The first row preselects the first `saving`
  category (by position) when one exists, instead of matching the name
  "Savings". If there is no saving category, it falls back to today's
  "Choose a category" prompt. (Debt payoff is not preselected — assigning
  leftover income to debt paydown is a deliberate choice, not the default
  the way topping up savings is.)
- **Overview category table.** Rows are grouped the same way (Spending /
  Saving / Debt payoff sections with subtotals), same order. The existing
  totals row becomes a grand total across all three; no new figures.
- **API.** `GET /api/categories` and the category object in
  `GET /api/budgets/[month]` include `type`. `POST /api/categories` accepts
  an optional `type` (defaults to `spending`); `PATCH /api/categories/[id]`
  accepts `type` alongside the existing fields.

## Out of scope
- Any change to how Unallocated, income, or bills totals are computed —
  every amount stays exactly as defined in specs 007/008/010.
- A "spent vs. saved" breakdown on the Overview cash-flow card, category
  trends split by type, or any new chart — that belongs in the future
  Trends spec, which can now use `type` once it exists.
- Tracking actual balances for a savings/debt category (e.g. a Roth IRA's
  current value). This spec only classifies the *budget line*; real balances
  are a later, bigger feature (probably alongside accounts/transactions).
- A bill-level type field. Bills already reference a category and inherit
  its type implicitly (e.g. an automatic Roth contribution modeled as a
  bill in a `saving` category); no schema change needed there.
- Restricting which type a bill or receipt line item can point at.

## Acceptance criteria
- [x] `categories.type` exists, defaults to `spending`, and accepts
      `spending` | `saving` | `debt payoff` (covered by a migration test and
      schema check).
- [x] The starter "Savings" category is created as `saving`; other starters
      are `spending` (covered by a test).
- [x] Creating and editing a category's type works end to end via the API
      and the Category manager UI (covered by tests).
- [x] The Budget page and the Overview category table group rows into
      Spending / Saving / Debt payoff sections in that order, each with a
      subtotal, omitting empty groups; the grand total is unchanged from
      before this spec (covered by render tests and in the browser).
- [x] The Assign-unallocated panel preselects the first `saving` category
      by position, not by name; with no saving category it prompts as
      before (covered by tests, replacing the name-matching test).
- [x] `GET /api/categories` and `GET /api/budgets/[month]` return `type`
      for every category (covered by tests).
- [x] Existing acceptance criteria and behavior from specs 004, 007, 008,
      010 continue to pass unchanged (regression: full test suite, lint,
      build, `npm run test:e2e`).
- [x] Documentation updated (see Documentation).

## Technical notes
- **Schema:** add `type` to `categories` (`text`, not null, default
  `'spending'`), a Postgres check constraint restricting it to
  `'spending' | 'saving' | 'debt payoff'` (or a native enum — check what the
  rest of `schema.ts` already uses for small closed sets; if nothing
  precedents an enum, a checked text column matches the low-ceremony style
  of `archived_from`/`interval_months`). New Drizzle migration in
  `drizzle/`.
- **`src/lib/categories.ts`:** `STARTER_CATEGORIES` becomes a list of
  `{ name, type }` (or a small lookup keyed by name) so `insertStarterCategories`
  sets `Savings` to `saving`. `listCategories` selects `type`.
  `createCategory` takes an optional `type` (validate against the allowed
  set, default `spending`). `CategoryPatch` gains `type?`, applied in
  `updateCategory` the same way `name` is (no versioning, no side effects on
  archiving).
- **`src/lib/budgets.ts`:** `BudgetLine` gains `type`; the `getBudget` query
  selects `categories.type` alongside the rest. No change to any total.
- **Grouping helper:** a small shared function (e.g.
  `groupByType<T extends { type: CategoryType }>(lines: T[])` in
  `src/lib/categories.ts` or a UI-side util) returns the three ordered
  groups with empties dropped, used by `BudgetEditor` and `CategoryTable` so
  the grouping logic isn't duplicated.
- **`BudgetEditor.tsx`:** render three `<ul>` sections (reusing the current
  row markup) instead of one flat list; each section gets a small subtotal
  row using `--surface` like the existing total row. `AssignUnallocated`'s
  `savings` lookup becomes `lines.find((l) => l.type === "saving")` (still
  by position since `lines` is already position-ordered).
- **`CategoryManager.tsx`:** add a `<select>` for type next to the rename
  input, patched via the existing `patch(id, { type })` path; the add form
  gets the same selector, defaulting to Spending.
- **`src/components/overview/CategoryTable.tsx` / `src/lib/overview.ts`:**
  `OverviewCategory` gains `type`; group rows the same way as the Budget
  page, each group's subtotal row styled like the existing totals row.
- **Validation:** add a small `categoryType` validator in `src/lib/validate.ts`
  (or inline in the route) shared by the POST and PATCH routes.
- **Tests:** extend `tests/categories.test.ts` (or wherever category CRUD is
  covered) for type defaulting/validation and the starter-category type;
  extend `tests/budgets.test.ts`/`tests/plan.test.ts` for grouped lines and
  the assign preselect; extend `tests/plan-ui.test.tsx` and
  `tests/overview-ui.test.tsx` for the grouped render output; browser tests
  in `e2e/` for the Category manager's type selector and the grouped Budget
  page/Overview, checked in both themes and at phone width.

## Decisions
- Two types were considered (Spending / Saving) but a third, Debt payoff,
  was added: paying down a credit card or loan isn't spending in the
  budgeting sense either, and it's a natural third bucket most budgeting
  tools already separate out.
- No hierarchy under `saving` (e.g. distinguishing retirement from
  brokerage) — that's just the category name, same as today; `type` only
  answers "what kind of line is this," not "which account."
- `type` is not time-versioned like allocations or bill amounts. It is a
  classification, like the name, so changing it changes how the category is
  grouped everywhere, past and future — there is no scenario here (unlike
  money amounts) where a stale past classification needs to be preserved.
- Debt payoff is deliberately not preselected by Assign-unallocated, unlike
  Saving. Topping up savings with leftover income is the obvious default;
  extra debt paydown is a real financial choice the household should make
  explicitly.
- Scope is grouping and classification only. The Overview's "spent vs.
  saved" story and any new charts wait for the Trends spec, which can build
  on `type` once it exists instead of guessing from category names.

## Documentation
- `README.md`: mention category types where categories/budgets are
  described.
- `CLAUDE.md`: the `type` field, its allowed values, that it is not
  time-versioned, the grouping behavior on the Budget page and Overview,
  and that Assign-unallocated preselects by type now.
- `specs/004-categories-and-budgets.md`: note the type field was added by
  this spec.
- `specs/007-bills-and-budget-polish.md`: note the Assign preselect is now
  type-based, not name-based.

## Verification
Fresh `docker compose up --build`: in Categories, add a Roth IRA and a
brokerage category as type Saving, and a credit card category as type Debt
payoff. Confirm the Budget page shows them in a separate Saving section and
the credit card in its own Debt payoff section, each with a correct
subtotal, and the grand Budgeted total matches what it was before. Confirm
the Overview category table groups the same way. With income above budget,
open Assign and confirm it preselects the first Saving category (not by
name) rather than one of the new Spending or Debt payoff categories. Rename
"Savings" to something else and confirm the Assign preselect still follows
it (now tracking by type, not name). Check both themes and phone width. Run
tests, lint, build, and `npm run test:e2e`.

## Implementation notes
- **Deviation from the plan:** `CATEGORY_TYPES`, `TYPE_LABELS` and
  `groupByType` were pulled into a new `src/lib/categoryTypes.ts` with no
  database import, instead of living in `src/lib/categories.ts` as the
  Technical notes suggested. `categories.ts` imports `getDb`, and
  `CategoryManager`/`BudgetEditor` are client components — importing the
  constants from `categories.ts` pulled `postgres` into the client bundle
  and broke `next build` ("Module not found: Can't resolve 'tls'"). Moving
  the pure pieces to their own leaf module fixed it; `categories.ts`
  re-exports only the `CategoryType` type (type-only, so it costs nothing).
- Each type gets its own `<tbody>` in `CategoryTable`, with `scope="rowgroup"`
  (not `colgroup`) on the header cell — the correct HTML-AAM mapping for a
  header over a group of *rows*, and the one that maps to the `rowheader`
  ARIA role assistive tech and the render tests check for.
- The Category manager's rename input and the "New category" input needed an
  explicit `w-48!` instead of the shared `w-full`: once the row became
  `flex-wrap` (to fit the new type select), a 100%-width flex item forces a
  line break on its own before the browser considers shrinking it, which put
  every row on two lines. Screenshot review caught this.
- Tests: `tests/budgets.test.ts` gained the type-defaulting, type-validation,
  starter-category-type and not-time-versioned cases; `tests/overview.test.ts`
  and `tests/overview-ui.test.tsx` cover the API/render shape and grouping
  (including the `rowgroup`/`rowheader` markup and an empty-groups case).
  New `e2e/categories.spec.ts` covers the grouped Budget page, adding a Debt
  payoff category, changing a category's type, and the grouped Overview
  table. `e2e/assign.spec.ts` gained a test that renames "Savings" and
  confirms the preselect still follows it by type — this fails against the
  old name-matching code and is the regression guard for the fix.
- Verified: 273 Vitest tests, 103 browser tests (3 skipped, production-only),
  `npm run test:e2e:docker`, lint, typecheck, build, and screenshots reviewed
  in both themes and at phone width on the Budget and Overview pages.

## Not verified
Real Safari and iOS (the WebKit project is not run); Firefox (does not
launch in this environment).
