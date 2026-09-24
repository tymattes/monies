import { expect, test } from "@playwright/test";
import { OWNER, SEED, resetAndSeed } from "./support/seed";
import { monthKey } from "./support/seed";
import { signIn, waitHydrated } from "./support/page";

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

const input = (cents: number) => (cents / 100).toFixed(2);

// Mirrors src/lib/months.ts monthLabel — the real clock, so tests compute
// the label instead of hardcoding a month name.
const monthName = (offset = 0) => {
  const [y, m] = monthKey(offset).split("-").map(Number);
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
};

// Option labels carry the target's current amount (spec 016): goals read
// "Name · $X" (no "budgeted" suffix — that was the removed category group).
const optLabel = (name: string, amountCents: number) => `${name} · ${money(amountCents)}`;

test.beforeEach(async ({ page }) => {
  await resetAndSeed(); // each test changes budget amounts
  await signIn(page, OWNER);
  await page.goto("/goals"); // the panel lives here, near the top (spec 032)
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
  await expect(p.getByLabel("Amount for goal 1", { exact: true })).toHaveValue(input(SEED.unallocatedCents));
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
  // evenSplit gives the odd cent to the first row (spec 016).
  const half = Math.floor(SEED.unallocatedCents / 2);
  await expect(p.getByLabel("Amount for goal 1", { exact: true })).toHaveValue(input(half + 1));
  await expect(p.getByLabel("Amount for goal 2", { exact: true })).toHaveValue(input(half));
  await expect(p).toContainText("Assigning all of it");

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/assign-unallocated") && r.request().method() === "POST"),
    p.getByRole("button", { name: "Assign" }).click(),
  ]);
  expect(response.ok()).toBeTruthy();

  // Both goal targets grew by their split. Unallocated is unchanged (spec
  // 022: a target is a plan, not a claim), so the panel stays open. Already
  // on Goals (spec 032), so the refreshed amounts show with no navigation.
  await expect(page.getByLabel("Savings", { exact: true })).toHaveValue(input(SEED.goals.Savings + half + 1));
  await expect(page.getByLabel("Vacation", { exact: true })).toHaveValue(input(half));
});

test("a row can be removed, and a target cannot be chosen twice", async ({ page }) => {
  // A second goal, so there is something to add a row for beyond Savings.
  await page.request.post("/api/goals", { data: { name: "Vacation", type: "saving" } });
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
  await p.getByLabel("Amount for goal 1", { exact: true }).fill(input(SEED.unallocatedCents + 1));
  await expect(p).toContainText("more than the unallocated amount");
  await expect(p.getByRole("button", { name: "Assign" })).toBeDisabled();
  await p.getByLabel("Amount for goal 1", { exact: true }).fill("");
  await expect(p.getByRole("button", { name: "Assign" })).toBeDisabled();
});

test("preselects by type, not name: renaming the Savings goal keeps it preselected", async ({ page }) => {
  const nameInput = page.getByLabel("Name of Savings", { exact: true });
  await nameInput.fill("House Fund");
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/goals/") && r.request().method() === "PATCH"),
    nameInput.blur(),
  ]);
  expect(response.ok()).toBeTruthy();

  // Already on Goals (spec 032) — no navigation needed to see the panel.
  const p = panel(page);
  await expect(p.getByLabel("Goal 1", { exact: true }).locator("option:checked")).toHaveText(
    optLabel("House Fund", SEED.goals.Savings),
  );
});

test("can assign part of it; the goal grows but Unallocated is unchanged (spec 022)", async ({ page }) => {
  const p = panel(page);
  await p.getByLabel("Amount for goal 1", { exact: true }).fill("400.00");
  await expect(p).toContainText(`${money(SEED.unallocatedCents - 40000)} stays unallocated`);
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/assign-unallocated") && r.request().method() === "POST"),
    p.getByRole("button", { name: "Assign" }).click(),
  ]);
  expect(response.ok()).toBeTruthy();
  // The goal target grew by $400, but Unallocated is untouched — a target is
  // a plan, not a claim (spec 022).
  await expect(page.getByRole("region", { name: "Plan summary" })).toContainText(money(SEED.unallocatedCents));
  await expect(panel(page)).toContainText(`Assign the unallocated ${money(SEED.unallocatedCents)}`);

  // spec 026: the panel confirms what happened and resets its rows to empty,
  // disabling Assign until re-entered. It no longer links to Goals for the
  // confirmation (spec 032) — the panel already lives there.
  await expect(p).toContainText(`Added ${money(40000)} to Savings for ${monthName()}. Check it off below when the money moves.`);
  await expect(p.getByLabel("Amount for goal 1", { exact: true })).toHaveValue("");
  await expect(p.getByRole("button", { name: "Assign" })).toBeDisabled();

  // The refreshed Goals editor, right below, already shows the new amount.
  await expect(page.getByLabel("Savings", { exact: true })).toHaveValue(input(SEED.goals.Savings + 40000));
});

test("editing a row after a confirmed assign clears the confirmation", async ({ page }) => {
  const p = panel(page);
  await p.getByLabel("Amount for goal 1", { exact: true }).fill("400.00");
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/assign-unallocated") && r.request().method() === "POST"),
    p.getByRole("button", { name: "Assign" }).click(),
  ]);
  await expect(p).toContainText("Added");

  await p.getByLabel("Amount for goal 1", { exact: true }).fill("100.00");
  await expect(p).not.toContainText("Added");
  await expect(p).toContainText("stays unallocated");
});
