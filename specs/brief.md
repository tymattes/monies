## Overview

Monies is a self-hosted, household-centric budgeting app, built as a web app first with a companion iOS app planned later. This brief asks for research and specification work only, not production code.

Guiding principles:

- **Household first.** Every budget, account, and transaction belongs to a household, not an individual.
- **Low-friction entry.** Capturing spend (especially by photographing receipts) should take seconds.
- **Modern, rich UX.** The interface should follow current design trends and make dashboards genuinely useful, not decorative.
- **Self-hosted and private.** The owner runs it on their own infrastructure, and the project is intended to be open-sourced, so it must be simple to deploy and back up, with a documented Docker Compose setup that also works as a Portainer stack.

## Core requirements

The app is named **Monies**. These are the functional requirements the specs must cover.

| Area | Requirement |
| --- | --- |
| Budgets | Monthly, category-driven budgets. Category allocations can change over time, and history is preserved so past months stay accurate. |
| Income | Users set income per household member. Support both fixed monthly income (salary) and variable income (freelance, bonuses, irregular deposits). |
| Household model | Everything is scoped to a household with multiple members. Self-hosted, so setup should include creating a household and inviting members. |
| Receipt capture | Users photograph a receipt with the device camera. The app parses merchant, date, total, and ideally line items, then lets the user review before saving. |
| Dashboards | Rich and useful: budget vs. actual, category trends, income vs. spend, and household-level and per-member views. |
| Platforms | Web app now. Design the API and architecture so a native iOS companion app can be added later without a rewrite. |