import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";
import { OWNER, SEED, monthKey, resetAndSeed, resetAndSeedFixedOnly, resetEmpty } from "./support/seed";
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

// The Overview's other states, for review: a brand-new household, and a month
// budgeted past its income. (These change the data, so they run last.)
for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} Overview states`, () => {
    test.use({ colorScheme: scheme });

    test("empty household", async ({ page }, info) => {
      await resetEmpty();
      await signIn(page, OWNER);
      await page.goto("/");
      await waitHydrated(page);
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `overview-empty-${scheme}-${info.project.name}.png`), fullPage: true });
    });

    test("over budget with only fixed income (a real error)", async ({ page }, info) => {
      await resetAndSeedFixedOnly();
      await signIn(page, OWNER);
      await page.goto("/");
      await waitHydrated(page);
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `overview-over-allocated-${scheme}-${info.project.name}.png`), fullPage: true });
    });

    test("over-committed while variable income may still arrive", async ({ page }, info) => {
      await resetAndSeed();
      await signIn(page, OWNER);
      const M = monthKey();
      const budget = await (await page.request.get(`/api/budgets/${M}`)).json();
      const transport = budget.categories.find((c: { name: string }) => c.name === "Transport").id;
      await page.request.post("/api/bills", {
        data: { name: "Car loan", amountCents: SEED.incomeCents + 100000 - SEED.billsCents, categoryId: transport },
      });
      await page.goto("/");
      await waitHydrated(page);
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `overview-over-recorded-${scheme}-${info.project.name}.png`), fullPage: true });
    });
  });
}
