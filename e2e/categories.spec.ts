import { expect, test } from "@playwright/test";
import { OWNER, SEED, resetAndSeed } from "./support/seed";
import { signIn, waitHydrated } from "./support/page";

// Spec 012: categories carry a type (Spending / Saving / Debt payoff) that
// groups them on the Budget page and the Overview, replacing the old
// name-matching heuristic for "Savings". The rename-based preselect case
// lives in assign.spec.ts.

test.beforeEach(async ({ page }) => {
  await resetAndSeed(); // each test changes categories
  await signIn(page, OWNER);
  await page.goto("/budget");
  await waitHydrated(page);
});

const budgetList = (page: import("@playwright/test").Page) =>
  page.locator("ul").filter({ has: page.getByText("Category", { exact: true }) });

test("the seeded household (all Spending, one Saving) shows two sections and no Debt payoff", async ({ page }) => {
  const list = budgetList(page);
  await expect(list.getByText("Spending", { exact: true })).toBeVisible();
  await expect(list.getByText("Saving", { exact: true })).toBeVisible();
  await expect(list.getByText("Debt payoff", { exact: true })).toHaveCount(0);
  await expect(list.getByText("Spending total")).toBeVisible();
  await expect(list.getByText("Saving total")).toBeVisible();
});

test("adding a Debt payoff category creates that section", async ({ page }) => {
  await page.getByLabel("New category name", { exact: true }).fill("Credit card");
  await page.getByLabel("New category type", { exact: true }).selectOption({ label: "Debt payoff" });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await waitHydrated(page);

  const list = budgetList(page);
  await expect(list.getByText("Debt payoff", { exact: true })).toBeVisible();
  await expect(list.getByText("Debt payoff total")).toBeVisible();
  await expect(page.getByLabel("Credit card", { exact: true })).toBeVisible(); // its budget input
});

test("changing a category's type moves it to the other section", async ({ page }) => {
  await page.getByLabel("Type of Other", { exact: true }).selectOption({ label: "Saving" });

  const list = budgetList(page);
  // Other's row now sits in the Saving section, after the Saving header.
  // The patch + router.refresh() is async, so poll instead of reading once.
  await expect
    .poll(async () => {
      const order = await list.locator("li").allTextContents();
      const savingIdx = order.findIndex((t) => t.trim() === "Saving");
      const otherIdx = order.findIndex((t) => t.includes("Other"));
      return savingIdx >= 0 && otherIdx > savingIdx;
    })
    .toBe(true);
});

test("the Overview category table groups the same way", async ({ page }) => {
  await page.goto("/");
  await waitHydrated(page);
  const table = page.getByRole("table");
  await expect(table.getByRole("rowheader", { name: "Spending", exact: true })).toBeVisible();
  await expect(table.getByRole("rowheader", { name: "Saving", exact: true })).toBeVisible();
  await expect(table.getByRole("rowheader", { name: "Spending total" })).toBeVisible();
  await expect(table.getByRole("rowheader", { name: "Saving total" })).toBeVisible();
  // Grand total is still the sum across every type, unchanged by grouping.
  await expect(table.getByRole("row").filter({ hasText: "Total" }).last()).toContainText(
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(SEED.budgetedCents / 100),
  );
});
