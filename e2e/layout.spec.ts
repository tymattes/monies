import { expect, test } from "@playwright/test";
import { OWNER, resetAndSeed } from "./support/seed";
import { SIGNED_IN_PAGES, SIGNED_OUT_PAGES, signIn, waitHydrated } from "./support/page";

// Phone project only (see playwright.config.ts): iPhone 13 dimensions.
test.beforeAll(resetAndSeed);

// Compares against the device's real width (the configured viewport), not
// window.innerWidth: in mobile emulation the browser widens the layout viewport
// to fit overflowing content, which would hide exactly the problem we look for.
async function overflow(page: import("@playwright/test").Page) {
  const width = page.viewportSize()!.width;
  return page.evaluate((deviceWidth) => ({
    scrollWidth: document.documentElement.scrollWidth,
    deviceWidth,
    // Anything visible that pokes out past the right edge of the device.
    offenders: [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.right > deviceWidth + 1;
      })
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}${el.getAttribute("aria-label") ? `[${el.getAttribute("aria-label")}]` : ""}: ${(el.textContent ?? "").trim().slice(0, 30)}`),
  }), width);
}

for (const p of SIGNED_OUT_PAGES) {
  test(`${p.name} fits the phone width`, async ({ page }) => {
    await page.goto(p.path);
    await waitHydrated(page);
    const o = await overflow(page);
    expect(o.scrollWidth, "the page scrolls sideways").toBeLessThanOrEqual(o.deviceWidth);
    expect(o.offenders, "elements extend past the right edge of the screen").toEqual([]);
  });
}

for (const p of SIGNED_IN_PAGES) {
  test(`${p.name} fits the phone width`, async ({ page }) => {
    await signIn(page, OWNER);
    await page.goto(p.path);
    await waitHydrated(page);
    const o = await overflow(page);
    expect(o.scrollWidth, "the page scrolls sideways").toBeLessThanOrEqual(o.deviceWidth);
    expect(o.offenders, "elements extend past the right edge of the screen").toEqual([]);
  });
}

test("the header's controls are all on screen and reachable on a phone", async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto("/budget");
  await waitHydrated(page);
  const viewport = page.viewportSize()!;
  const targets = [
    page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Overview" }),
    page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Plan" }),
    page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Members" }),
    page.getByRole("button", { name: "Sign out" }),
    page.getByRole("group", { name: "Theme" }),
  ];
  for (const t of targets) {
    await expect(t).toBeVisible();
    const box = (await t.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  }
});

test("the Budget table's key controls are not clipped on a phone", async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto("/budget");
  await waitHydrated(page);
  const input = page.getByLabel("Groceries", { exact: true });
  const box = (await input.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await expect(page.getByRole("region", { name: "Plan summary" })).toBeVisible();
});
