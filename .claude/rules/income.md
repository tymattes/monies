---
paths:
  - "src/lib/{income,validate}.ts"
  - "src/app/api/income/**"
  - "src/app/income/**"
  - "src/components/IncomeView.tsx"
  - "src/components/overview/IncomeCard.tsx"
  - "tests/income.test.ts"
---

# Income and provisional income

- Income (`src/lib/income.ts`): fixed sources keep a time-versioned amount in `income_amounts`; variable sources record actual `income_deposits` counted in the month of `received_on`. `assertCanEdit` allows an owner, or the source's own member; removed members' sources have `member_id` null and are owner-only. Shared validators in `src/lib/validate.ts`.
- Provisional income (spec 010): `getIncomeMonth` sets `provisional` for the current or a later month when a variable source is active. It changes wording/tone/severity only, never amounts; `category_over_budget` is never softened.
