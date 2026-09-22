import { expect, test } from "@playwright/test";
import { OWNER, SEED, resetAndSeed } from "./support/seed";
import { monthKey } from "./support/seed";
import { signIn, waitHydrated } from "./support/page";

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

// Option labels carry the target's current amount (spec 016): goals read
// "Name · $X" (no "budgeted" suffix — that was the removed category group).
const optLabel = (name: string, amountCents: number) => `${name} · ${money(amountCents)}`;

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
  await expect(p.getByLabel("Goal 1", { exact: true })).toHaveValue(/.+/); // a target id, not the prompt
  await expect(p.getByLabel("Goal 1", { exact: true }).locator("option:checked")).toHaveText(
    optLabel("Savings", SEED.goals.Savings),
  );
  await expect(p.getByLabel("Amount for goal 1", { exact: true })).toHaveValue("900.00");
  await expect(p.getByRole("button", { name: "Assign" })).toBeEnabled();
  // spec 017: a one-month top-up, not a permanent raise.
  await expect(p).toContainText("goes back to the earlier amount unless you change it");
});

test("offers only goals — no category options", async ({ page }) => {
  const p = panel(page);
  const options = p.getByLabel("Goal 1", { exact: true }).locator("option");
  await expect(options).toHaveCount(2); // the prompt + Savings
  await expect(options.filter({ hasText: "Savings" })).toHaveCount(1);
  await expect(p).not.toContainText("budgeted");
});

test("splits across two goals in one click", async ({ page }) => {
  // Seed a second goal so there is something to split into besides Savings.
  const M = monthKey();
  const created = await (
    await page.request.post("/api/goals", { data: { name: "Vacation", type: "saving" } })
  ).json();
  await page.request.put(`/api/goals/month/${M}/amounts/${created.goal.id}`, { data: { amountCents: 0 } });
  await page.reload();
  await waitHydrated(page);

  const p = panel(page);
  await p.getByRole("button", { name: "Add goal", exact: true }).click();
  await p.getByLabel("Goal 2", { exact: true }).selectOption({
    label: optLabel("Vacation", 0),
  });
  await p.getByRole("button", { name: "Split evenly" }).click();
  await expect(p.getByLabel("Amount for goal 1", { exact: true })).toHaveValue("450.00");
  await expect(p.getByLabel("Amount for goal 2", { exact: true })).toHaveValue("450.00");
  await expect(p).toContainText("Assigning all of it");

  await p.getByRole("button", { name: "Assign" }).click();

  // Everything applied together: unallocated is 0 and the panel is gone.
  await expect(panel(page)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Plan summary" })).toContainText(
    money(SEED.budgetedCents + SEED.unallocatedCents),
  );
  await page.goto("/goals");
  await expect(page.getByLabel("Savings", { exact: true })).toHaveValue("1450.00");
  await expect(page.getByLabel("Vacation", { exact: true })).toHaveValue("450.00");
});

test("a row can be removed, and a target cannot be chosen twice", async ({ page }) => {
  // A second goal, so there is something to add a row for beyond Savings.
  const created = await (
    await page.request.post("/api/goals", { data: { name: "Vacation", type: "saving" } })
  ).json();
  await page.reload();
  await waitHydrated(page);

  const p = panel(page);
  await p.getByRole("button", { name: "Add goal", exact: true }).click();
  await expect(p.getByLabel("Goal 2", { exact: true })).toBeVisible();
  // Savings is taken by row 1, so it is not offered in row 2.
  await expect(p.getByLabel("Goal 2", { exact: true }).locator("option", { hasText: "Savings" })).toHaveCount(0);
  await p.getByRole("button", { name: "Remove goal 2" }).click();
  await expect(p.getByLabel("Goal 2", { exact: true })).toHaveCount(0);
});

test("stays disabled with a clear message when the amounts are too large", async ({ page }) => {
  const p = panel(page);
  await p.getByLabel("Amount for goal 1", { exact: true }).fill("900.01");
  await expect(p).toContainText("more than the unallocated amount");
  await expect(p.getByRole("button", { name: "Assign" })).toBeDisabled();
  await p.getByLabel("Amount for goal 1", { exact: true }).fill("");
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
  await expect(p.getByLabel("Goal 1", { exact: true }).locator("option:checked")).toHaveText(
    optLabel("House Fund", SEED.goals.Savings),
  );
});

test("can assign part of it and leave the rest unallocated", async ({ page }) => {
  const p = panel(page);
  await p.getByLabel("Amount for goal 1", { exact: true }).fill("400.00");
  await expect(p).toContainText(`${money(50000)} stays unallocated`);
  await p.getByRole("button", { name: "Assign" }).click();
  await expect(page.getByRole("region", { name: "Plan summary" })).toContainText(money(50000)); // 500.00 left
  await expect(panel(page)).toContainText(`Assign the unallocated ${money(50000)}`);

  await page.goto("/goals");
  await expect(page.getByLabel("Savings", { exact: true })).toHaveValue("1400.00");
});
