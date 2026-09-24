import { expect, test } from "@playwright/test";
import { OWNER, SEED, monthKey, resetAndSeed } from "./support/seed";
import { signIn, waitHydrated } from "./support/page";

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

test.beforeEach(async ({ page }) => {
  await resetAndSeed(); // each test changes goals
  await signIn(page, OWNER);
  await page.goto("/goals");
  await waitHydrated(page);
});

test("is the fourth Plan tab, not a top-level destination", async ({ page }) => {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Goals");
  await expect(page.getByRole("navigation", { name: "Main" }).locator('[aria-current="page"]')).toHaveText("Plan");
  await expect(page.getByRole("navigation", { name: "Plan sections" }).locator('[aria-current="page"]')).toHaveText("Goals");
});

test("shows the seeded Savings goal with its amount and an unchecked box", async ({ page }) => {
  await expect(page.getByLabel("Savings", { exact: true })).toHaveValue(
    (SEED.goals.Savings / 100).toFixed(2),
  );
  await expect(page.getByLabel("Savings: done this month", { exact: true })).not.toBeChecked();
});

test("editing the amount saves and carries forward to later months", async ({ page }) => {
  const amount = page.getByLabel("Savings", { exact: true });
  await amount.fill("250.00");
  await amount.blur();
  await expect(page.getByText("Saved")).toBeVisible();

  await page.goto(`/goals?month=${monthKey(1)}`);
  await expect(page.getByLabel("Savings", { exact: true })).toHaveValue("250.00");
});

test("saving an amount refreshes the Plan summary only when the goal is checked off", async ({ page }) => {
  const amount = page.getByLabel("Savings", { exact: true });
  const summary = page.getByRole("region", { name: "Plan summary" });

  // Unchecked: the amount is a plan, so editing it does not move Unallocated (spec 022).
  await amount.fill("250.00");
  await amount.blur();
  await expect(page.getByText("Saved")).toBeVisible();
  await expect(summary).toContainText(money(SEED.unallocatedCents));

  // Checked off: now the amount is a claim, so editing it moves Unallocated,
  // and GoalEditor's own router.refresh() shows that without navigation.
  await page.getByLabel("Savings: done this month", { exact: true }).check();
  await expect(summary).toContainText(money(SEED.unallocatedCents - 25000));

  await amount.fill("300.00");
  await amount.blur();
  await expect(page.getByText("Saved")).toBeVisible();
  await expect(summary).toContainText(money(SEED.unallocatedCents - 30000));
});

test("checking a goal off persists, and is independent per month", async ({ page }) => {
  const box = page.getByLabel("Savings: done this month", { exact: true });
  const summary = page.getByRole("region", { name: "Plan summary" });
  await expect(summary).toContainText(money(SEED.unallocatedCents));

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/checkins/") && r.request().method() === "PUT"),
    box.check(),
  ]);
  expect(response.ok()).toBeTruthy();
  // No navigation: GoalEditor's own router.refresh() moves the Plan summary (spec 024).
  await expect(summary).toContainText(money(SEED.unallocatedCents - SEED.goals.Savings));

  const [unchecked] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/checkins/") && r.request().method() === "PUT"),
    box.uncheck(),
  ]);
  expect(unchecked.ok()).toBeTruthy();
  await expect(summary).toContainText(money(SEED.unallocatedCents));

  await page.reload();
  await waitHydrated(page);
  await expect(page.getByLabel("Savings: done this month", { exact: true })).not.toBeChecked();

  await page.goto(`/goals?month=${monthKey(1)}`);
  await expect(page.getByLabel("Savings: done this month", { exact: true })).not.toBeChecked();
});

// The checkbox being editable for any month, unlike the amount, is covered
// at the unit level (tests/goals.test.ts) — a brand-new household has
// nothing before "this month" to visit in a real browser, so there is no
// real past month to exercise here.

test("adding a Debt payoff goal groups it separately from Saving", async ({ page }) => {
  await page.getByLabel("New goal name", { exact: true }).fill("Credit card");
  await page.getByLabel("New goal type", { exact: true }).selectOption({ label: "Debt payoff" });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await waitHydrated(page);

  // The section header, not the type <select>'s own "Debt payoff" option.
  await expect(page.locator('li[aria-hidden="true"]', { hasText: "Debt payoff" })).toBeVisible();
  await expect(page.getByLabel("Credit card", { exact: true })).toBeVisible();
});

test("renaming, retyping, reordering and archiving a goal all work", async ({ page }) => {
  await page.getByLabel("New goal name", { exact: true }).fill("Roth IRA");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await waitHydrated(page);

  const rename = page.getByLabel("Name of Roth IRA", { exact: true });
  await rename.fill("Roth IRA (Vanguard)");
  const [renamed] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/goals/") && r.request().method() === "PATCH"),
    rename.blur(),
  ]);
  expect(renamed.ok()).toBeTruthy();
  await expect(page.getByLabel("Name of Roth IRA (Vanguard)", { exact: true })).toBeVisible();

  const typeSelect = page.getByLabel("Type of Roth IRA (Vanguard)", { exact: true });
  await typeSelect.selectOption({ label: "Debt payoff" });
  await expect(typeSelect).toHaveValue("debt payoff");

  await page.getByRole("button", { name: "Move Roth IRA (Vanguard) up" }).click();

  page.once("dialog", (d) => d.accept());
  const row = page.getByRole("listitem").filter({ has: page.getByLabel("Name of Roth IRA (Vanguard)", { exact: true }) });
  await row.getByRole("button", { name: "Archive" }).click();
  await waitHydrated(page);
  await expect(page.getByText(/Archived \(1\)/)).toBeVisible();
});

test("a goal's target does not reduce Unallocated (spec 022)", async ({ page }) => {
  await page.goto("/budget");
  await waitHydrated(page);
  // The seeded Savings goal is funded at 1,000 but unchecked, so it claims no
  // income: Unallocated is income − bills, unaffected by the goal's target.
  await expect(page.getByRole("region", { name: "Plan summary" })).toContainText(money(SEED.unallocatedCents));
});
