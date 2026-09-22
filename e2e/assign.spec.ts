import { expect, test } from "@playwright/test";
import { OWNER, SEED, resetAndSeed } from "./support/seed";
import { signIn, waitHydrated } from "./support/page";

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

test.beforeEach(async ({ page }) => {
  await resetAndSeed(); // each test changes budget amounts
  await signIn(page, OWNER);
  await page.goto("/budget");
  await waitHydrated(page);
});

const panel = (page: import("@playwright/test").Page) => page.locator("#assign");

test("starts with Savings and the whole unallocated amount", async ({ page }) => {
  const p = panel(page);
  await expect(p).toContainText(`Assign the unallocated ${money(SEED.unallocatedCents)}`);
  await expect(p.getByLabel("Category 1", { exact: true })).toHaveValue(/.+/); // a category id, not the prompt
  await expect(p.getByLabel("Category 1", { exact: true }).locator("option:checked")).toHaveText("Savings");
  await expect(p.getByLabel("Amount for category 1", { exact: true })).toHaveValue("900.00");
  await expect(p.getByRole("button", { name: "Assign" })).toBeEnabled();
});

test("splits across several categories in one click", async ({ page }) => {
  const p = panel(page);
  await p.getByRole("button", { name: "Add category", exact: true }).click();
  await p.getByLabel("Category 2", { exact: true }).selectOption({ label: "Dining out" });
  await p.getByRole("button", { name: "Split evenly" }).click();
  await expect(p.getByLabel("Amount for category 1", { exact: true })).toHaveValue("450.00");
  await expect(p.getByLabel("Amount for category 2", { exact: true })).toHaveValue("450.00");
  await expect(p).toContainText("Assigning all of it");

  await p.getByRole("button", { name: "Assign" }).click();

  // Everything applied together: unallocated is 0 and both amounts grew.
  await expect(panel(page)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Plan summary" })).toContainText(money(SEED.budgetedCents + SEED.unallocatedCents));
  await expect(page.getByLabel("Savings", { exact: true })).toHaveValue("1450.00");
  await expect(page.getByLabel("Dining out", { exact: true })).toHaveValue("750.00");
});

test("a row can be removed, and a category cannot be chosen twice", async ({ page }) => {
  const p = panel(page);
  await p.getByRole("button", { name: "Add category", exact: true }).click();
  await expect(p.getByLabel("Category 2", { exact: true })).toBeVisible();
  // Savings is taken by row 1, so it is not offered in row 2.
  await expect(p.getByLabel("Category 2", { exact: true }).locator("option", { hasText: "Savings" })).toHaveCount(0);
  await p.getByRole("button", { name: "Remove category 2" }).click();
  await expect(p.getByLabel("Category 2", { exact: true })).toHaveCount(0);
});

test("stays disabled with a clear message when the amounts are too large", async ({ page }) => {
  const p = panel(page);
  await p.getByLabel("Amount for category 1", { exact: true }).fill("900.01");
  await expect(p).toContainText("more than the unallocated amount");
  await expect(p.getByRole("button", { name: "Assign" })).toBeDisabled();
  await p.getByLabel("Amount for category 1", { exact: true }).fill("");
  await expect(p.getByRole("button", { name: "Assign" })).toBeDisabled();
});

test("preselects by type, not name (spec 012): renaming Savings keeps it preselected", async ({ page }) => {
  const nameInput = page.getByLabel("Name of Savings", { exact: true });
  await nameInput.fill("House Fund");
  await nameInput.blur();
  await waitHydrated(page);

  const p = panel(page);
  await expect(p.getByLabel("Category 1", { exact: true }).locator("option:checked")).toHaveText("House Fund");
});

test("can assign part of it and leave the rest unallocated", async ({ page }) => {
  const p = panel(page);
  await p.getByLabel("Amount for category 1", { exact: true }).fill("400.00");
  await expect(p).toContainText(`${money(50000)} stays unallocated`);
  await p.getByRole("button", { name: "Assign" }).click();
  await expect(page.getByRole("region", { name: "Plan summary" })).toContainText(money(50000)); // 500.00 left
  await expect(page.getByLabel("Savings", { exact: true })).toHaveValue("1400.00");
  await expect(panel(page)).toContainText(`Assign the unallocated ${money(50000)}`);
});
