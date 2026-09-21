import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";
import { OWNER, resetAndSeed } from "./support/seed";
import { SIGNED_IN_PAGES, SIGNED_OUT_PAGES, signIn, waitHydrated } from "./support/page";

// Screenshots for people (and Claude) to review visual polish. Not pixel-compared.
// Run with `npm run e2e:screenshots`; output goes to e2e-screenshots/ (git-ignored).
const OUT = path.join(process.cwd(), "e2e-screenshots");

test.beforeAll(async () => {
  mkdirSync(OUT, { recursive: true });
  await resetAndSeed();
});

test.afterAll(() => {
  const lines = [
    "# Screenshots",
    "",
    "Seeded household, one image per page, theme and viewport (full page).",
    "",
    ...readdirSync(OUT).filter((f) => f.endsWith(".png")).sort().map((f) => `- ${f}`),
    "",
  ];
  writeFileSync(path.join(OUT, "INDEX.md"), lines.join("\n"));
});

for (const scheme of ["light", "dark"] as const) {
  test.describe(scheme, () => {
    test.use({ colorScheme: scheme });

    const shoot = async (page: import("@playwright/test").Page, name: string, project: string) => {
      await waitHydrated(page);
      await page.waitForTimeout(300); // let fonts and layout settle
      const file = `${name}-${scheme}-${project}.png`;
      await page.screenshot({ path: path.join(OUT, file), fullPage: true });
    };

    for (const p of SIGNED_OUT_PAGES) {
      test(`${p.name}`, async ({ page }, info) => {
        await page.goto(p.path);
        await shoot(page, p.name, info.project.name);
      });
    }
    for (const p of SIGNED_IN_PAGES) {
      test(`${p.name}`, async ({ page }, info) => {
        await signIn(page, OWNER);
        await page.goto(p.path);
        await shoot(page, p.name, info.project.name);
      });
    }
  });
}
