import { expect, test, type Page } from "@playwright/test";
import { OWNER, resetAndSeed } from "./support/seed";
import { waitHydrated } from "./support/page";

// Signing in through the real form: by clicking the button and by pressing Enter,
// and what happens with wrong details. Runs on every browser project.
test.beforeAll(resetAndSeed);

async function open(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  await page.goto("/sign-in");
  await waitHydrated(page);
  return problems;
}

async function expectSignedIn(page: Page, problems: string[]) {
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hub");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  expect(problems, "the page threw errors").toEqual([]);
}

test("clicking Sign in signs in and lands on the Hub", async ({ page }) => {
  const problems = await open(page);
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill(OWNER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expectSignedIn(page, problems);
});

test("pressing Enter in the password field signs in", async ({ page }) => {
  const problems = await open(page);
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill(OWNER.password);
  await page.getByLabel("Password").press("Enter");
  await expectSignedIn(page, problems);
});

test("pressing Enter in the email field signs in too", async ({ page }) => {
  const problems = await open(page);
  await page.getByLabel("Password").fill(OWNER.password);
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Email").press("Enter");
  await expectSignedIn(page, problems);
});

test("wrong details show a message and stay on the sign-in screen", async ({ page }) => {
  const problems = await open(page);
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill("not the password");
  await page.getByLabel("Password").press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: /./ }).first()).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  expect(problems).toEqual([]);
});

test("submitting never puts the password in the address bar", async ({ page }) => {
  await open(page);
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill(OWNER.password);
  await page.getByLabel("Password").press("Enter");
  await expect(page).toHaveURL(/\/$/);
  expect(page.url()).not.toContain("password");
});

test("signing out returns to the sign-in screen with a signed-out header", async ({ page }) => {
  const problems = await open(page);
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill(OWNER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expectSignedIn(page, problems);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
});
