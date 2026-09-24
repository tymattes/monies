import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  DARK_CARD,
  DARK_PAGE,
  DARK_SUBTLE,
  LIGHT_CARD,
  LIGHT_DANGER,
  LIGHT_PAGE,
  LIGHT_SUBTLE,
  bodyBackground,
  cents,
  money,
  signIn,
  waitHydrated,
} from "./support/page";
import {
  FIXED_ONLY,
  OWNER,
  SEED,
  expectedCategoryRows,
  monthKey,
  resetAndSeed,
  resetAndSeedFixedOnly,
  resetEmpty,
} from "./support/seed";

const cashFlow = (page: Page) => page.getByRole("region", { name: /^Cash flow in/ });
const legend = (page: Page) => cashFlow(page).getByRole("list");
const bar = (page: Page) => cashFlow(page).getByRole("img");

test.describe("with a seeded household", () => {
  test.beforeAll(resetAndSeed);
  test.beforeEach(async ({ page }) => {
    await signIn(page, OWNER);
    await page.goto("/");
  });

  test("is the home page", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Overview");
    await expect(page.getByText(SEED.household, { exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" }).locator('[aria-current="page"]')).toHaveText("Overview");
  });

  test("the cash-flow card shows the month's headline numbers", async ({ page }) => {
    const card = cashFlow(page);
    await expect(card).toContainText(money(SEED.incomeCents));
    await expect(card).toContainText(money(SEED.billsCents));
    await expect(card).not.toContainText("Left after bills");
    await expect(card).toContainText("Unallocated Income");
    await expect(card).toContainText(money(SEED.unallocatedCents));
  });

  test("shows Saving (from the seeded goal) but not Debt payoff, since no such goal exists (spec 014)", async ({ page }) => {
    const card = cashFlow(page);
    await expect(card).toContainText("Saving");
    await expect(card).toContainText(money(SEED.goals.Savings));
    await expect(card).not.toContainText("Debt payoff");
  });

  test("the bar's segments add up to the income, and its text equivalent says so", async ({ page }) => {
    // The seeded Savings goal is unchecked and there are no expenses, so the
    // bar draws only Bills and Unallocated — the two terms that are real in
    // this household (spec 021: an unchecked target contributes nothing).
    const items = await legend(page).getByRole("listitem").allTextContents();
    expect(items[0]).toContain("Bills");
    expect(items[0]).toContain(money(SEED.billsCents));
    expect(items[1]).toContain("Unallocated Income");
    expect(items[1]).toContain(money(SEED.unallocatedCents));
    expect(items).toHaveLength(2); // no Expenses, no Saving/Debt payoff segment

    await expect(bar(page)).toHaveAttribute("aria-label", new RegExp(`Income ${money(SEED.incomeCents).replace("$", "\\$")}`));
    await expect(bar(page)).toHaveAttribute("aria-label", new RegExp(`${money(SEED.billsCents).replace("$", "\\$")} bills`));
    await expect(bar(page)).toHaveAttribute("aria-label", new RegExp(`${money(SEED.unallocatedCents).replace("$", "\\$")} unallocated income`));
    await expect(bar(page)).not.toHaveAttribute("aria-label", /expenses/);
    await expect(bar(page)).not.toHaveAttribute("aria-label", /saving/);
  });

  test("Unallocated here equals the Plan summary bar's", async ({ page }) => {
    await expect(cashFlow(page)).toContainText(money(SEED.unallocatedCents));
    await page.goto("/budget");
    await expect(page.getByRole("region", { name: "Plan summary" })).toContainText(money(SEED.unallocatedCents));
  });

  test("the Budget section is headed 'Budget' with an Edit budget link", async ({ page }) => {
    const budget = page.getByRole("heading", { name: "Budget", exact: true }).locator("..");
    await expect(budget.getByRole("link", { name: "Edit budget" })).toHaveAttribute("href", "/budget");
  });

  test("the category table matches the seeded budget, bills and what is left", async ({ page }) => {
    const table = page.getByRole("table");
    for (const c of expectedCategoryRows()) {
      const row = table.getByRole("row").filter({ has: page.getByRole("rowheader", { name: new RegExp(`^${c.name}`) }) });
      await expect(row.getByRole("cell").nth(0)).toHaveText(money(c.budgeted));
      await expect(row.getByRole("cell").nth(1)).toHaveText(money(c.bills));
      await expect(row.getByRole("cell").nth(2)).toHaveText(money(0)); // no seeded expenses
      await expect(row.getByRole("cell").nth(3)).toHaveText(money(c.left));
    }
    // Utilities' bills are over its budget: a negative Left in the error color.
    const utilities = table.getByRole("row").filter({ has: page.getByRole("rowheader", { name: /^Utilities/ }) });
    await expect(utilities.getByRole("cell").nth(3)).toHaveText("-$70.00");
    await expect(utilities.getByRole("cell").nth(3)).toHaveCSS("color", LIGHT_DANGER);
    await expect(page.getByRole("table").locator("tfoot")).toContainText(money(SEED.categoriesBudgetedCents));
    await expect(page.getByRole("table").locator("tfoot")).toContainText(money(SEED.billsCents));
    await expect(page.getByRole("columnheader", { name: /Expenses/ })).toBeVisible();
  });

  test("the category table agrees with the Budget page", async ({ page }) => {
    const overview = new Map<string, string>();
    for (const c of expectedCategoryRows()) {
      const row = page.getByRole("table").getByRole("row").filter({ has: page.getByRole("rowheader", { name: new RegExp(`^${c.name}`) }) });
      overview.set(c.name, (await row.getByRole("cell").nth(0).textContent()) ?? "");
    }
    await page.goto("/budget");
    await waitHydrated(page);
    for (const [name, budgeted] of overview) {
      const input = await page.getByLabel(name, { exact: true }).inputValue();
      expect(cents(`$${Number(input).toFixed(2)}`)).toBe(cents(budgeted));
    }
  });

  test("needs attention names the over-budget category, the unallocated money, and the unchecked goal, with links", async ({ page }) => {
    const list = page.getByRole("region", { name: "Needs attention" });
    const over = list.getByRole("listitem").filter({ hasText: "Utilities: is $70.00 over its budget." });
    await expect(over).toContainText("Warning:");
    await expect(over.getByRole("link", { name: "Adjust budget" })).toHaveAttribute("href", "/budget");

    const free = list.getByRole("listitem").filter({ hasText: `${money(SEED.unallocatedCents)} is still unallocated` });
    await expect(free.getByRole("link", { name: "Assign" })).toHaveAttribute("href", /\/income(\?month=[\d-]+)?#assign$/);

    // The seeded Savings goal is funded but unchecked this month (spec 015).
    const goal = list.getByRole("listitem").filter({ hasText: "Savings hasn't been checked off yet this month." });
    await expect(goal.getByRole("link", { name: "Check off" })).toHaveAttribute("href", "/goals");
    await expect(list.getByRole("listitem")).toHaveCount(3);
  });

  test("Assign from the Overview reaches the Income panel, focused", async ({ page }) => {
    await cashFlow(page).getByRole("link", { name: "Assign" }).click();
    await expect(page).toHaveURL(/\/income.*#assign/);
    await expect(page.locator("#assign select").first()).toBeFocused();
    await expect(page.locator("#assign")).toBeInViewport();
  });

  test("the income and bills cards summarise the seeded data", async ({ page }) => {
    const income = page.getByRole("region", { name: "Income", exact: true });
    await expect(income).toContainText(money(SEED.incomeCents));
    await expect(income).toContainText(`Fixed monthly${money(SEED.salaryCents)}`);
    await expect(income).toContainText(`Variable (deposits)${money(SEED.freelanceCents)}`);
    await expect(income).toContainText("Olive Owner");
    await expect(income).toContainText("Mia Member");
    await income.getByRole("link", { name: "Add income" }).click();
    await expect(page).toHaveURL(/\/income/);
  });

  test("the bills card shows the monthly total and the five largest bills, biggest first", async ({ page }) => {
    const bills = page.getByRole("region", { name: "Bills", exact: true });
    await expect(bills).toContainText(`${money(SEED.billsCents)} / month`);
    const largest = bills.getByText("Largest").locator("xpath=following-sibling::ul[1]/li");
    await expect(largest).toHaveCount(5);
    await expect(largest.first()).toContainText("Rent");
    await expect(largest.first()).toContainText(money(150000));
    // The yearly bill is only 10.00 a month, so it is not among the five largest.
    await expect(bills.getByText("Cloud storage")).toHaveCount(0);
    await bills.getByRole("link", { name: "Add bill" }).click();
    await expect(page).toHaveURL(/\/bills/);
  });

  test("the expenses card explains a month with nothing logged and links to Expenses", async ({ page }) => {
    const expenses = page.getByRole("region", { name: "Expenses", exact: true });
    await expect(expenses).toContainText("No expenses logged this month yet.");
    await expenses.getByRole("link", { name: "Log expense" }).click();
    await expect(page).toHaveURL(/\/expenses/);
  });

  test("the goals card shows the seeded Saving goal with its amount and check-off status (spec 015)", async ({ page }) => {
    const goals = page.getByRole("region", { name: "Goals" });
    await expect(goals).toContainText(money(SEED.goals.Savings));
    await expect(goals).toContainText("Saving");
    await expect(goals).toContainText("Savings");
    await expect(goals).toContainText("Not checked off yet");
    await expect(goals).not.toContainText("Debt payoff");
    await goals.getByRole("link", { name: "Check off" }).click();
    await expect(page).toHaveURL(/\/goals/);
  });

  test("another month keeps the month in every link, and only the fixed income carries forward", async ({ page }) => {
    const next = monthKey(1);
    await page.getByRole("link", { name: "Next month" }).click();
    await expect(page).toHaveURL(new RegExp(`/\\?month=${next}`));
    await expect(page.getByRole("link", { name: "This month" })).toBeVisible();

    // The salary repeats but the one-off freelance deposit does not, while the
    // bills carry forward: next month's Unallocated is the fixed salary minus
    // bills (spec 022 — budgeted amounts reserve nothing, so they don't carry
    // into an over-allocated state either).
    await expect(cashFlow(page)).toContainText(money(SEED.salaryCents));
    // Variable income may still arrive next month (provisional), shown on the
    // card, not as an alarm in the list.
    await expect(cashFlow(page)).toContainText("Variable income counts once you record it.");
    const list = page.getByRole("region", { name: "Needs attention" });
    await expect(list).toContainText(`${money(SEED.salaryCents - SEED.billsCents)} is still unallocated`);
    // The Utilities item (bills past a category's own budget) is still a warning.
    await expect(list.getByRole("listitem").filter({ hasText: "Utilities: is" })).toContainText("Warning:");
    await expect(list.getByRole("link", { name: "Adjust budget" })).toHaveAttribute("href", `/budget?month=${next}`);
    // Next month has unallocated income (not over-allocated), so Assign is offered.
    const free = list.getByRole("listitem").filter({ hasText: "is still unallocated" });
    await expect(free.getByRole("link", { name: "Assign" })).toHaveAttribute("href", new RegExp(`/income\\?month=${next}#assign`));
    await expect(page.getByRole("region", { name: "Income", exact: true }).getByRole("link", { name: "Add income" })).toHaveAttribute("href", `/income?month=${next}`);
  });

  test("a past month is read-only: no Assign and no setup prompts", async ({ page }) => {
    await page.goto(`/?month=${monthKey(-1)}`);
    await expect(cashFlow(page)).toBeVisible();
    await expect(page.getByRole("link", { name: "Assign" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Needs attention" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /get your month set up/ })).toHaveCount(0);
  });
});

test.describe("adding a Debt payoff goal (spec 014)", () => {
  test.beforeEach(async ({ page }) => {
    await resetAndSeed();
    await signIn(page, OWNER);
    const M = monthKey();
    const created = await (
      await page.request.post("/api/goals", { data: { name: "Credit card", type: "debt payoff" } })
    ).json();
    await page.request.put(`/api/goals/month/${M}/amounts/${created.goal.id}`, { data: { amountCents: 15000 } });
    // Check both goals off so their checked amounts show as bar segments
    // (spec 021: an unchecked target contributes nothing to the bar).
    const budget = await (await page.request.get(`/api/budgets/${M}`)).json();
    const savings = budget.goals.find((g: { name: string }) => g.name === "Savings").id;
    await page.request.put(`/api/goals/month/${M}/checkins/${savings}`, { data: { checked: true } });
    await page.request.put(`/api/goals/month/${M}/checkins/${created.goal.id}`, { data: { checked: true } });
    await page.goto("/");
  });

  test("shows Debt payoff alongside Saving on the cash-flow card", async ({ page }) => {
    const card = cashFlow(page);
    await expect(card).toContainText("Saving");
    await expect(card).toContainText("Debt payoff");
    await expect(card).toContainText(money(15000));
  });

  test("the one bar's text equivalent names all the checked segments, never color alone", async ({ page }) => {
    const label = new RegExp(
      `${money(SEED.goals.Savings).replace("$", "\\$")} saving.*${money(15000).replace("$", "\\$")} debt payoff`,
    );
    await expect(bar(page)).toHaveAttribute("aria-label", label);
  });
});

test.describe("an empty household", () => {
  test.beforeAll(resetEmpty);
  test.beforeEach(async ({ page }) => {
    await signIn(page, OWNER);
    await page.goto("/");
  });

  test("explains what to add first, in order, with links", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Let's get your month set up" })).toBeVisible();
    const steps = page.getByRole("region", { name: /get your month set up/ }).getByRole("link");
    await expect(steps).toHaveText(["Add your income", "Set your category budgets", "Add your recurring bills", "Review your goals"]);
    await expect(steps.nth(0)).toHaveAttribute("href", "/income");
    await expect(cashFlow(page)).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Needs attention" })).toHaveCount(0);
  });

  for (const scheme of ["light", "dark"] as const) {
    test.describe(scheme, () => {
      test.use({ colorScheme: scheme });
      test("passes the accessibility scan", async ({ page }) => {
        await waitHydrated(page);
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
      });
    });
  }
});

test.describe("over-committed while variable income may still arrive", () => {
  test.beforeEach(async ({ page }) => {
    await resetAndSeed();
    await signIn(page, OWNER);
    // A bill that pushes bills past income by $1,000 (spec 022: over-allocated
    // means real commitments exceed income, not that budgeted amounts do).
    const M = monthKey();
    const budget = await (await page.request.get(`/api/budgets/${M}`)).json();
    const transport = budget.categories.find((c: { name: string }) => c.name === "Transport").id;
    const res = await page.request.post("/api/bills", {
      data: {
        name: "Car loan",
        amountCents: SEED.incomeCents + 100000 - SEED.billsCents,
        categoryId: transport,
      },
    });
    expect(res.ok()).toBeTruthy();
    await page.goto("/");
  });

  test("says Over recorded income by, neutrally, with a plain note in the list", async ({ page }) => {
    const card = cashFlow(page);
    await expect(card).toContainText("Over recorded income by");
    await expect(card).toContainText(money(100000));
    await expect(card).toContainText("Variable income counts once you record it.");
    await expect(card).not.toContainText("Over-allocated");
    await expect(card.getByText("Over recorded income by").first()).not.toHaveCSS("color", LIGHT_DANGER);
    await expect(card.getByRole("img")).toHaveAttribute("aria-label", /above recorded income by \$1,000\.00/);
    await expect(card.getByRole("link", { name: "Assign" })).toHaveCount(0);

    const item = page.getByRole("region", { name: "Needs attention" }).getByRole("listitem").filter({ hasText: "exceed the income recorded so far" });
    await expect(item).toContainText("Bills, expenses and checked-off goals exceed the income recorded so far by $1,000.00. Variable income counts once you record it.");
    await expect(item).not.toContainText("Warning:");
    await expect(item.getByRole("link", { name: "Review budget" })).toBeVisible();
  });
});

test.describe("over-committed with only fixed income", () => {
  test.beforeEach(async ({ page }) => {
    await resetAndSeedFixedOnly(); // a bill makes its commitments exceed income by $1,000
    await signIn(page, OWNER);
    await page.goto("/");
  });

  test("is still an error: Over-allocated by in red, and a warning", async ({ page }) => {
    const card = cashFlow(page);
    await expect(card).toContainText(money(FIXED_ONLY.incomeCents));
    await expect(card).toContainText("Over-allocated by");
    await expect(card).toContainText(money(FIXED_ONLY.overAllocatedCents));
    await expect(card).not.toContainText("Variable income counts");
    await expect(card.getByText("Over-allocated by").first()).toHaveCSS("color", LIGHT_DANGER);
    await expect(card.getByRole("img")).toHaveAttribute("aria-label", /over-allocated by \$1,000\.00/);

    const warning = page.getByRole("region", { name: "Needs attention" }).getByRole("listitem").filter({ hasText: "Bills, expenses and checked-off goals exceed your income by $1,000.00." });
    await expect(warning).toContainText("Warning:");
  });
});

// Cards must read as raised panels on a deeper page, and tables must have a
// distinct header row (spec 011).
for (const [scheme, page, card, subtle] of [
  ["light", LIGHT_PAGE, LIGHT_CARD, LIGHT_SUBTLE],
  ["dark", DARK_PAGE, DARK_CARD, DARK_SUBTLE],
] as const) {
  test.describe(`layered surfaces (${scheme})`, () => {
    test.use({ colorScheme: scheme });
    test.beforeAll(resetAndSeed);

    test("cards and tables are separate from the page and from each other", async ({ page: p }) => {
      await signIn(p, OWNER);
      await p.goto("/");
      expect(await bodyBackground(p)).toBe(page);

      const regions = [
        p.getByRole("region", { name: /^Cash flow in/ }),
        p.getByRole("region", { name: "Income", exact: true }),
        p.getByRole("region", { name: "Bills", exact: true }),
        p.getByRole("region", { name: "Expenses", exact: true }),
        p.getByRole("region", { name: "Goals", exact: true }),
        p.getByRole("region", { name: "Needs attention" }).getByRole("listitem").first(),
      ];
      for (const region of regions) {
        await expect(region).toHaveCSS("background-color", card);
        await expect(region).toHaveCSS("border-top-width", "1px");
      }

      const table = p.getByRole("table");
      await expect(table.locator("thead tr")).toHaveCSS("background-color", subtle);
      await expect(table.locator("tfoot tr")).not.toHaveCSS("background-color", card);
      await expect(table.locator("tfoot tr")).not.toHaveCSS("background-color", subtle);
    });

    test("the Plan pages use cards too", async ({ page: p }) => {
      await signIn(p, OWNER);
      for (const path of ["/budget", "/bills", "/income"]) {
        await p.goto(path);
        await expect(p.getByRole("region", { name: "Plan summary" })).toHaveCSS("background-color", card);
      }
    });

    test("the sign-in screen is one card on the page color: heading, welcome line and form together", async ({ page: p }) => {
      await p.goto("/sign-in");
      expect(await bodyBackground(p)).toBe(page);
      const card_ = p.getByLabel("Email").locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
      await expect(card_).toHaveCSS("background-color", card);
      await expect(card_.getByRole("heading", { name: "Sign in" })).toBeVisible();
      await expect(card_.getByText("Welcome back to Monies.")).toBeVisible();
      await expect(card_.getByRole("button", { name: "Sign in" })).toBeVisible();
    });
  });
}
