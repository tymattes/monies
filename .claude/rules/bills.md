---
paths:
  - "src/lib/{bills,categories}.ts"
  - "src/app/api/{bills,categories}/**"
  - "src/app/bills/**"
  - "src/components/BillsView.tsx"
  - "src/components/overview/BillsCard.tsx"
  - "tests/bills.test.ts"
  - "e2e/bills.spec.ts"
---

# Bills

- Bills (`src/lib/bills.ts`): amount, period (`interval_months` 1/3/6/12) and category versioned together in `bill_versions` (same latest-effective-month, read-only-past rules). The monthly equivalent is computed, never stored, in `monthlyEquivalent` and in the SQL of `activeBills` — keep the two in sync (`tests/bills.test.ts` compares them). `updateCategory` refuses to archive a category while bills use it or will move into it. `bills.paid_by` (spec 043) is a nullable member reference (`ON DELETE SET NULL`), replacing the old free-text `paid_with`; it's optional from the start, unlike `added_by`, so a null `paid_by` is ambiguous between "no payer chosen" and "payer removed" and both just render as no payer — there is no "Former member" case for it the way there is for `added_by`.
