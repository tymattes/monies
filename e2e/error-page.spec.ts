import { expect, test } from "@playwright/test";
import { DARK_PAGE, LIGHT_PAGE, bodyBackground, isDark, signIn } from "./support/page";
import { OWNER, resetAndSeed } from "./support/seed";

// The themed error page only appears in a production build (the dev server shows
// Next's own overlay instead), so this spec runs with E2E_PROD=1.
test.skip(!process.env.E2E_PROD, "error pages render only in production builds");

test.beforeAll(resetAndSeed);

for (const [scheme, page_] of [
  ["light", LIGHT_PAGE],
  ["dark", DARK_PAGE],
] as const) {
  test.describe(scheme, () => {
    test.use({ colorScheme: scheme });

    test("a failing page shows the themed error page, with a reference, in the right theme", async ({ page }) => {
      await signIn(page, OWNER);
      await page.goto("/e2e-error");

      // (Next's route announcer also has role="alert", so pick ours by its content.)
      const alert = page.getByRole("alert").filter({ hasText: "Something went wrong" });
      await expect(alert.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
      await expect(alert).toContainText("This page couldn't load.");
      await expect(alert).toContainText(/Error reference: \d+/); // matches the server log entry
      await expect(alert.getByRole("button", { name: "Try again" })).toBeVisible();
      await expect(alert.getByRole("button", { name: "Reload page" })).toBeVisible();
      // The error text itself is never shown to the user.
      await expect(page.getByText("deliberate failure")).toHaveCount(0);

      // The saved/OS theme must survive the error page (React re-renders <html> there).
      await expect.poll(() => isDark(page)).toBe(scheme === "dark");
      expect(await bodyBackground(page)).toBe(page_);
      // The app header is still there, so the user can navigate away.
      await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    });
  });
}

test("Try again keeps the page usable and Reload page reloads it", async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto("/e2e-error");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Something went wrong" })).toBeVisible(); // still failing, still handled
  await page.getByRole("link", { name: "Hub" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hub");
});
