---
paths:
  - "src/components/{Header,HeaderNav,PlanHeader,PlanTabs,PlanSummary,MonthNav}.tsx"
  - "src/components/overview/GetStarted.tsx"
  - "src/app/**/page.tsx"
  - "src/app/layout.tsx"
  - "tests/plan-ui.test.tsx"
  - "e2e/{plan,layout}.spec.ts"
---

# Navigation, Plan header and page descriptions

- Navigation (`HeaderNav`): four top-level destinations — Overview (`/`), Plan (opens `/income`; active on `/budget`, `/bills`, `/income`, `/goals`), Expenses (`/expenses`, spec 019), Household (`/household`; renamed from Members in spec 044 — `/members` permanently redirects there). The active destination gets a `border-accent` underline, matching `PlanTabs`' own active-tab treatment, and "Plan" carries a static `▾` hint since it opens onto four sub-sections (spec 037). Income | Budget | Bills | Goals are `PlanTabs` under `PlanHeader` (title, `PlanTabs`, `MonthNav`, `PlanSummary`), in that order to match the Overview set-up checklist (spec 029). `PlanSummary` shows the three headline stats plus this month's open tasks as compact link chips (spec 033) — Assign among them, not a separate button; `PlanSummaryData.tasks` comes from `planSummaryFromBudget`/`getPlanSummary` (`src/lib/plan.ts`). On Budget, where `BudgetEditor` renders its own live summary from local state, `tasks` is still server-given and static like `unallocatedCents` — editing an amount doesn't recompute it. `PlanHeader` is a component, not a layout, because Next.js layouts cannot read `searchParams`. Every top-level page carries a one-line description under its title (spec 042): the four Plan tabs pull theirs from `PlanHeader`'s `DESCRIPTIONS` table keyed on `title`; Hub, Expenses and Household render theirs inline since they don't use `PlanHeader`. Keep this copy consistent with `README.md`'s Philosophy/Features wording — it's a label, not documentation, so one sentence each. `GetStarted` (`src/components/overview/GetStarted.tsx`) has a matching intro line above its steps making clear the checklist is guidance, not a completeness requirement.
