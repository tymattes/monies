import { expect, test } from "@playwright/test";
import { FIXED_ONLY, OWNER, SEED, monthKey, resetAndSeed, resetAndSeedFixedOnly } from "./support/seed";
import { LIGHT_DANGER, signIn, waitHydrated } from "./support/page";

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

const summary = (page: import("@playwright/test").Page) =>
  page.getByRole("region", { name: "Plan summary" });

test.describe("navigation", () => {
  test.beforeAll(resetAndSeed);
  test.beforeEach(({ page }) => signIn(page, OWNER));

  test("the header has Overview, Plan, Expenses and Members, with the right one current", async ({ page }) => {
    const main = page.getByRole("navigation", { name: "Main" });
    const cases: [string, string][] = [
      ["/", "Overview"],
      ["/budget", "Plan"],
      ["/bills", "Plan"],
      ["/income", "Plan"],
      ["/goals", "Plan"],
      ["/expenses", "Expenses"],
      ["/members", "Members"],
    ];
    for (const [path, current] of cases) {
      await page.goto(path);
      await expect(main.getByRole("link")).toHaveText(["Overview", "Plan", "Expenses", "Members"]);
      await expect(main.locator('[aria-current="page"]')).toHaveText(current);
    }
    await expect(main.getByRole("link", { name: "Plan" })).toHaveAttribute("href", "/budget");
  });

  test("the Plan tabs mark the current page and keep the selected month", async ({ page }) => {
    const next = monthKey(1);
    const tabs = page.getByRole("navigation", { name: "Plan sections" });
    await page.goto(`/budget?month=${next}`);
    await expect(tabs.locator('[aria-current="page"]')).toHaveText("Budget");

    await tabs.getByRole("link", { name: "Bills" }).click();
    await expect(page).toHaveURL(new RegExp(`/bills\\?month=${next}`));
    await expect(tabs.locator('[aria-current="page"]')).toHaveText("Bills");
    await tabs.getByRole("link", { name: "Income" }).click();
    await expect(page).toHaveURL(new RegExp(`/income\\?month=${next}`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Income");
  });

  test("the summary bar shows the seeded numbers on all four Plan pages", async ({ page }) => {
    for (const path of ["/budget", "/bills", "/income", "/goals"]) {
      await page.goto(path);
      const bar = summary(page);
      await expect(bar).toContainText(money(SEED.incomeCents));
      await expect(bar).toContainText(money(SEED.budgetedCents));
      await expect(bar).toContainText(`of which bills ${money(SEED.billsCents)}`);
      await expect(bar).toContainText("Unallocated Income");
      await expect(bar).toContainText(money(SEED.unallocatedCents));
    }
  });

  test("a past month offers no Assign and no editing", async ({ page }) => {
    // The seeded household started this month, so last month has no categories
    // yet (nothing to edit); the summary bar still renders, without Assign.
    await page.goto(`/budget?month=${monthKey(-1)}`);
    await expect(summary(page)).toBeVisible();
    await expect(page.getByText(/No categories in/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Assign" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Assign" })).toHaveCount(0);
    await expect(page.locator("#assign")).toHaveCount(0);
  });
});

test.describe("Budget table layout", () => {
  test.beforeAll(resetAndSeed);
  test("the amount inputs are a fixed width, so the columns line up", async ({ page }) => {
    await signIn(page, OWNER);
    await page.goto("/budget");
    await waitHydrated(page);
    const boxes = await page.locator('input[id^="amount-"]').evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { width: Math.round(r.width), right: Math.round(r.right) };
      }),
    );
    expect(boxes.length).toBeGreaterThan(5);
    // w-32 is 8rem = 128px; a stray w-full would make these span the row.
    for (const b of boxes) expect(b.width).toBe(128);
    expect(new Set(boxes.map((b) => b.right)).size).toBe(1); // one shared right edge
  });
});

test.describe("the summary bar and Assign", () => {
  // These change data, so each test starts from a fresh seed.
  test.beforeEach(async ({ page }) => {
    await resetAndSeed();
    await signIn(page, OWNER);
  });

  test("updates live as a budget amount is edited", async ({ page }) => {
    await page.goto("/budget");
    await waitHydrated(page);
    const bar = summary(page);
    await expect(bar).toContainText(money(SEED.unallocatedCents));

    const groceries = page.getByLabel("Groceries", { exact: true });
    await groceries.fill("800.00");
    await groceries.blur();
    // 100.00 more budgeted: Budgeted rises and Unallocated falls, with no reload.
    await expect(bar).toContainText(money(SEED.budgetedCents + 10000));
    await expect(bar).toContainText(money(SEED.unallocatedCents - 10000));
  });

  test("being above the recorded income is shown plainly while variable income may still arrive", async ({ page }) => {
    await page.goto("/budget");
    await waitHydrated(page);
    const bar = summary(page);
    await expect(bar).toContainText("Variable income counts once you record it.");
    const housing = page.getByLabel("Housing", { exact: true });
    await housing.fill("2800.00"); // +1,000 => 6,100 budgeted vs 6,000 recorded
    await housing.blur();
    await expect(bar).toContainText("Over recorded income by");
    await expect(bar).toContainText(money(10000));
    await expect(bar).not.toContainText("Over-allocated");
    await expect(bar.getByText("Over recorded income by")).not.toHaveCSS("color", LIGHT_DANGER);
    await expect(bar.getByRole("button", { name: "Assign" })).toHaveCount(0);
  });

  test("Assign in the bar links to the Income panel", async ({ page }) => {
    await page.goto("/budget");
    await waitHydrated(page);
    await summary(page).getByRole("link", { name: "Assign" }).click();
    await expect(page).toHaveURL(new RegExp(`/income\\?month=${monthKey()}#assign`));
    await expect(page.locator("#assign select").first()).toBeFocused();
    await expect(page.locator("#assign")).toBeInViewport();
  });

  test("Assign from Bills and Goals lands on the Income panel, focused", async ({ page }) => {
    for (const from of ["/bills", "/goals"]) {
      await page.goto(from);
      await summary(page).getByRole("link", { name: "Assign" }).click();
      await expect(page).toHaveURL(new RegExp(`/income\\?month=${monthKey()}#assign`));
      await expect(page.locator("#assign select").first()).toBeFocused();
      await expect(page.locator("#assign")).toBeInViewport();
    }
  });

  test("Assign disappears once everything is assigned", async ({ page }) => {
    await page.goto("/income");
    await waitHydrated(page);
    const panel = page.locator("#assign");
    await panel.getByRole("button", { name: "Assign" }).click();
    await expect(panel).toHaveCount(0);
    await expect(summary(page)).toContainText(money(0));
    await expect(summary(page).getByRole("link", { name: "Assign" })).toHaveCount(0);
  });
});

test.describe("a household with only fixed income", () => {
  test.beforeEach(async ({ page }) => {
    await resetAndSeedFixedOnly();
    await signIn(page, OWNER);
  });

  test("keeps the red Over-allocated by, since its income is complete", async ({ page }) => {
    for (const path of ["/budget", "/bills", "/income"]) {
      await page.goto(path);
      const bar = summary(page);
      await expect(bar).toContainText(money(FIXED_ONLY.incomeCents));
      await expect(bar).toContainText("Over-allocated by");
      await expect(bar).toContainText(money(FIXED_ONLY.overAllocatedCents));
      await expect(bar).not.toContainText("Variable income counts");
      await expect(bar.getByText("Over-allocated by")).toHaveCSS("color", LIGHT_DANGER);
    }
  });
});
