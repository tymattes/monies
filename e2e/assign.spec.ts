import { expect, test } from "@playwright/test";
import { OWNER, SEED, resetAndSeed } from "./support/seed";
import { signIn, waitHydrated } from "./support/page";

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

// Option labels carry the target's current amount (spec 016): categories read
// "Name · $X budgeted", goals read "Name · $X".
const optLabel = (name: string, amountCents: number, suffix = "") =>
  `${name} · ${money(amountCents)}${suffix}`;

test.beforeEach(async ({ page }) => {
  await resetAndSeed(); // each test changes budget amounts
  await signIn(page, OWNER);
  await page.goto("/income");
  await waitHydrated(page);
});

const panel = (page: import("@playwright/test").Page) => page.locator("#assign");

test("starts with Savings and the whole unallocated amount", async ({ page }) => {
  const p = panel(page);
  await expect(p).toContainText(`Assign the unallocated ${money(SEED.unallocatedCents)}`);
  await expect(p.getByLabel("Category 1", { exact: true })).toHaveValue(/.+/); // a target id, not the prompt
  await expect(p.getByLabel("Category 1", { exact: true }).locator("option:checked")).toHaveText(
    optLabel("Savings", SEED.goals.Savings),
  );
  await expect(p.getByLabel("Amount for category 1", { exact: true })).toHaveValue("900.00");
  await expect(p.getByRole("button", { name: "Assign" })).toBeEnabled();
  // spec 017: a one-month top-up, not a permanent raise.
  await expect(p).toContainText("goes back to the earlier amount unless you change it");
});

test("splits across a category and the preselected goal in one click", async ({ page }) => {
  const p = panel(page);
  await p.getByRole("button", { name: "Add category", exact: true }).click();
  await p.getByLabel("Category 2", { exact: true }).selectOption({
    label: optLabel("Dining out", SEED.budgets["Dining out"], " budgeted"),
  });
  await p.getByRole("button", { name: "Split evenly" }).click();
  await expect(p.getByLabel("Amount for category 1", { exact: true })).toHaveValue("450.00");
  await expect(p.getByLabel("Amount for category 2", { exact: true })).toHaveValue("450.00");
  await expect(p).toContainText("Assigning all of it");

  await p.getByRole("button", { name: "Assign" }).click();

  // Everything applied together: unallocated is 0 and the panel is gone.
  await expect(panel(page)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Plan summary" })).toContainText(
    money(SEED.budgetedCents + SEED.unallocatedCents),
  );
  // The category grew on Budget (spec 015: the panel lives on Income now)...
  await page.goto("/budget");
  await expect(page.getByLabel("Dining out", { exact: true })).toHaveValue("750.00");
  // ...and the goal grew on its own page (spec 014: goals are not on /budget).
  await page.goto("/goals");
  await expect(page.getByLabel("Savings", { exact: true })).toHaveValue("1450.00");
});

test("a row can be removed, and a target cannot be chosen twice", async ({ page }) => {
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

test("preselects by type, not name: renaming the Savings goal keeps it preselected", async ({ page }) => {
  await page.goto("/goals");
  await waitHydrated(page);
  const nameInput = page.getByLabel("Name of Savings", { exact: true });
  await nameInput.fill("House Fund");
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/goals/") && r.request().method() === "PATCH"),
    nameInput.blur(),
  ]);
  expect(response.ok()).toBeTruthy();

  await page.goto("/income");
  const p = panel(page);
  await expect(p.getByLabel("Category 1", { exact: true }).locator("option:checked")).toHaveText(
    optLabel("House Fund", SEED.goals.Savings),
  );
});

test("can assign part of it and leave the rest unallocated", async ({ page }) => {
  const p = panel(page);
  await p.getByLabel("Amount for category 1", { exact: true }).fill("400.00");
  await expect(p).toContainText(`${money(50000)} stays unallocated`);
  await p.getByRole("button", { name: "Assign" }).click();
  await expect(page.getByRole("region", { name: "Plan summary" })).toContainText(money(50000)); // 500.00 left
  await expect(panel(page)).toContainText(`Assign the unallocated ${money(50000)}`);

  await page.goto("/goals");
  await expect(page.getByLabel("Savings", { exact: true })).toHaveValue("1400.00");
});
