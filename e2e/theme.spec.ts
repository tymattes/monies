import { expect, test } from "@playwright/test";
import {
  DARK_ACCENT,
  DARK_BG,
  LIGHT_ACCENT,
  LIGHT_BG,
  bodyBackground,
  isDark,
  waitHydrated,
} from "./support/page";
import { resetAndSeed } from "./support/seed";

test.beforeAll(resetAndSeed);

test.describe("follows the OS when nothing is saved", () => {
  test.describe("dark OS", () => {
    test.use({ colorScheme: "dark" });
    test("uses the Dracula palette", async ({ page }) => {
      await page.goto("/sign-in");
      expect(await isDark(page)).toBe(true);
      expect(await bodyBackground(page)).toBe(DARK_BG);
    });
  });

  test.describe("light OS", () => {
    test.use({ colorScheme: "light" });
    test("uses the Alucard palette", async ({ page }) => {
      await page.goto("/sign-in");
      expect(await isDark(page)).toBe(false);
      expect(await bodyBackground(page)).toBe(LIGHT_BG);
    });
  });

  test.describe("live change", () => {
    test.use({ colorScheme: "dark" });
    test("follows an OS change while on System", async ({ page }) => {
      await page.goto("/sign-in");
      await waitHydrated(page);
      await expect(page.locator("html")).toHaveClass(/\bdark\b/);
      await page.emulateMedia({ colorScheme: "light" });
      await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
      expect(await bodyBackground(page)).toBe(LIGHT_BG);
      await page.emulateMedia({ colorScheme: "dark" });
      await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    });
  });
});

test.describe("explicit choice", () => {
  test.use({ colorScheme: "light" });

  test("overrides the OS, persists across reloads, and System clears it", async ({ page }) => {
    await page.goto("/sign-in");
    await waitHydrated(page);
    const theme = page.getByRole("group", { name: "Theme" });

    await theme.getByRole("button", { name: "Dark theme" }).click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("dark");

    await page.reload();
    expect(await isDark(page)).toBe(true); // still dark although the OS is light
    await waitHydrated(page);
    await expect(theme.getByRole("button", { name: "Dark theme" })).toHaveAttribute("aria-pressed", "true");

    await theme.getByRole("button", { name: "System theme" }).click();
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
    expect(await page.evaluate(() => localStorage.getItem("theme"))).toBeNull();
    await expect(theme.getByRole("button", { name: "System theme" })).toHaveAttribute("aria-pressed", "true");

    await theme.getByRole("button", { name: "Light theme" }).click();
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/); // Light wins over a dark OS
  });

  test("the saved theme is applied before the app's JavaScript runs (no flash)", async ({ page, context }) => {
    await context.addInitScript(() => localStorage.setItem("theme", "dark"));
    // Block every script file: only the inline pre-paint script can apply the theme.
    await page.route(/\.js(\?.*)?$/, (route) => route.abort());
    await page.goto("/sign-in", { waitUntil: "domcontentloaded" });
    expect(await isDark(page)).toBe(true);
    expect(await bodyBackground(page)).toBe(DARK_BG);
  });

  test("the control works by keyboard", async ({ page }) => {
    await page.goto("/sign-in");
    await waitHydrated(page);
    const theme = page.getByRole("group", { name: "Theme" });
    await theme.getByRole("button", { name: "Dark theme" }).focus();
    await page.keyboard.press("Enter");
    await expect(theme.getByRole("button", { name: "Dark theme" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await page.keyboard.press("Shift+Tab"); // to the Light button
    await page.keyboard.press("Space");
    await expect(theme.getByRole("button", { name: "Light theme" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  });
});

test.describe("input focus uses the accent color", () => {
  test.describe("dark", () => {
    test.use({ colorScheme: "dark" });
    test("is Dracula green", async ({ page }) => {
      await page.goto("/sign-in");
      await page.getByLabel("Email").focus();
      await expect(page.getByLabel("Email")).toHaveCSS("border-top-color", DARK_ACCENT);
    });
  });
  test.describe("light", () => {
    test.use({ colorScheme: "light" });
    test("is Alucard green", async ({ page }) => {
      await page.goto("/sign-in");
      await page.getByLabel("Email").focus();
      await expect(page.getByLabel("Email")).toHaveCSS("border-top-color", LIGHT_ACCENT);
    });
  });
});
