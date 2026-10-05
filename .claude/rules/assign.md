---
paths:
  - "src/lib/budgets.ts"
  - "src/app/api/budgets/**"
  - "src/components/AssignUnallocated.tsx"
  - "tests/assign*.test.*"
  - "e2e/assign.spec.ts"
---

# Assign unallocated

- Assign unallocated (`assignUnallocated` in `src/lib/budgets.ts`, `POST /api/budgets/[month]/assign-unallocated`): adds leftover income to goals only (spec 020 — a category's budget is never touched by Assign, only by a manual edit on Budget), as normal allocations from that month onward, all-or-nothing, under a `pg_advisory_xact_lock` keyed on household and month. A `categoryId` anywhere in the body returns a named 400 pointing at Expenses. Assign is a one-month top-up, not a permanent raise (spec 017). The panel is `src/components/AssignUnallocated.tsx` at `#assign`, near the top of `/goals` (moved from `/income` in spec 032); it confirms a successful assign in its footnote and resets its rows to empty (so a repeat click can't double up the same goal) — the confirmation no longer links to Goals since the panel already lives there (spec 026, reworded in spec 032).
