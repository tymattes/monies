---
paths:
  - "specs/**"
---

# Writing specs

- Research must be completed before the specs are written. Cite sources for anything factual.
- Keep spec files under `specs/`.

## Product constraints from `specs/brief.md`

- Household is the root scope; every budget, account, and transaction belongs to a household, not an individual.
- Budgets are monthly and category-driven; allocations are time-versioned so history is preserved.
- Income is per member: fixed monthly and variable (freelance, bonuses, irregular deposits); owners edit everyone's, members edit their own.
- Receipt capture: photograph a receipt, parse merchant/date/total/line items, show a review step before saving.
- Dashboards: budget vs. actual, category trends, income vs. spend, household-level and per-member views.
- API-first; self-hosted, open-source (simple Docker Compose deploy and backup, also works as a Portainer stack).
