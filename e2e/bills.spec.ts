import { expect, test } from "@playwright/test";
import { MEMBER, OWNER, SEED, resetAndSeed } from "./support/seed";
import { signIn, waitHydrated } from "./support/page";

test.beforeEach(async ({ page }) => {
  await resetAndSeed();
  await signIn(page, OWNER);
});

test.describe("adding a bill", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/bills");
    await waitHydrated(page);
  });

  const form = (page: import("@playwright/test").Page) => page.getByRole("form", { name: "Add a bill" });

  test("the category starts on the prompt and cannot be skipped", async ({ page }) => {
    const f = form(page);
    const category = f.getByLabel("Category", { exact: true });
    await expect(category).toHaveValue("");
    await expect(category.locator("option:checked")).toHaveText("Choose a category");

    await f.getByLabel("Name", { exact: true }).fill("Gym");
    await f.getByLabel("Amount", { exact: true }).fill("40");
    await f.getByRole("button", { name: "Add bill" }).click();

    // The browser blocks the submit, so nothing is added and the category is flagged.
    await expect(category).toHaveJSProperty("validity.valueMissing", true);
    await expect(page.getByText("Gym", { exact: true })).toHaveCount(0);
  });

  test("shows a live monthly preview for a yearly bill, then adds it", async ({ page }) => {
    const f = form(page);
    await f.getByLabel("Name", { exact: true }).fill("Domain");
    await f.getByLabel("Amount", { exact: true }).fill("120");
    await f.getByLabel("Every", { exact: true }).selectOption("12");
    await expect(f).toContainText("= $10.00 / month");
    await f.getByLabel("Category", { exact: true }).selectOption({ label: "Other" });
    await f.getByRole("button", { name: "Add bill" }).click();

    const row = page.getByRole("listitem").filter({ hasText: "Domain" });
    await expect(row).toContainText("$120.00 / year");
    await expect(row).toContainText("about $10.00 / month");
    await expect(row).toContainText(`Added by ${OWNER.name}`);
  });

  test("choosing a payer from the member picker round-trips", async ({ page }) => {
    const f = form(page);
    await f.getByLabel("Name", { exact: true }).fill("Gym");
    await f.getByLabel("Amount", { exact: true }).fill("40");
    await f.getByLabel("Category", { exact: true }).selectOption({ label: "Health" });
    await f.getByLabel("Paid with (optional)", { exact: true }).selectOption({ label: MEMBER.name });
    await f.getByRole("button", { name: "Add bill" }).click();

    const row = page.getByRole("listitem").filter({ hasText: "Gym" });
    await expect(row).toContainText(`Paid with ${MEMBER.name}`);
  });
});

test("lists the seeded bills by category, with the yearly one spread monthly", async ({ page }) => {
  await page.goto("/bills");
  await expect(page.getByRole("region", { name: "Utilities" })).toContainText("$420.00 / month"); // phone+electric+water+internet
  const cloud = page.getByRole("listitem").filter({ hasText: "Cloud storage" });
  await expect(cloud).toContainText("$120.00 / year");
  await expect(cloud).toContainText("about $10.00 / month");
  await expect(page.getByText(`Bills in`)).toBeVisible();
  expect(SEED.bills.length).toBeGreaterThan(0);
});

test("ending a bill removes it from this month", async ({ page }) => {
  await page.goto("/bills");
  await waitHydrated(page);
  page.once("dialog", (d) => d.accept());
  const row = page.getByRole("listitem").filter({ hasText: "Streaming" });
  await row.getByRole("button", { name: "End" }).click();
  await expect(page.getByText("Streaming", { exact: true })).toHaveCount(0);
});

test("a category with bills cannot be archived", async ({ page }) => {
  await page.goto("/budget");
  await waitHydrated(page);
  page.once("dialog", (d) => d.accept());
  const row = page.getByRole("listitem").filter({ has: page.getByLabel("Name of Utilities", { exact: true }) });
  await row.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "4 active bills" })).toBeVisible();
});
