import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { OWNER, resetAndSeed } from "./support/seed";
import { SIGNED_IN_PAGES, SIGNED_OUT_PAGES, signIn, waitHydrated } from "./support/page";

// Automated scans catch only part of accessibility (Playwright says so too), so a
// clean run is a floor, not a certificate. We fail on serious and critical
// violations and print the rest for review.
//
// Rules deliberately waived, with the reason. Keep this list empty unless a
// rule is a false positive for this app.
const WAIVED_RULES: { id: string; reason: string }[] = [];

test.beforeAll(resetAndSeed);

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    const check = async (page: import("@playwright/test").Page, name: string) => {
      await waitHydrated(page);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .disableRules(WAIVED_RULES.map((r) => r.id))
        .analyze();
      const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      const minor = results.violations.filter((v) => !blocking.includes(v));
      if (minor.length) {
        console.log(`[axe] ${name} (${scheme}): ${minor.length} minor/moderate: ${minor.map((v) => v.id).join(", ")}`);
      }
      expect(
        blocking.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" ; ")}`),
      ).toEqual([]);
    };

    for (const p of SIGNED_OUT_PAGES) {
      test(`${p.name}`, async ({ page }) => {
        await page.goto(p.path);
        await check(page, p.name);
      });
    }
    for (const p of SIGNED_IN_PAGES) {
      test(`${p.name}`, async ({ page }) => {
        await signIn(page, OWNER);
        await page.goto(p.path);
        await check(page, p.name);
      });
    }
  });
}
