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

// The Hub's other states, for review: a brand-new household, and a month
// budgeted past its income. (These change the data, so they run last.)
for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} Hub states`, () => {
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

// The seed has no expenses on purpose (SEED.unallocatedCents depends on that),
// so a month's worth is logged here for the shots that show spend — the README
// images would otherwise read $0.00 in every Expenses column.
const DEMO_EXPENSES = [
  { category: "Groceries", amountCents: 9240, description: "Weekly shop", day: 2 },
  { category: "Transport", amountCents: 5875, description: "Fuel", day: 5 },
  { category: "Dining out", amountCents: 3410, description: "Thai takeaway", day: 9 },
  { category: "Groceries", amountCents: 4125, description: "Market", day: 14 },
  { category: "Health", amountCents: 2800, description: "Pharmacy", day: 18 },
  { category: "Entertainment", amountCents: 2400, description: "Cinema", day: 23 },
  { category: "Dining out", amountCents: 1850, description: "Coffee and pastries", day: 27 },
];

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} with logged expenses`, () => {
    test.use({ colorScheme: scheme });

    test("hub and expenses", async ({ page }, info) => {
      await resetAndSeed();
      await signIn(page, OWNER);
      const M = monthKey();
      const budget = await (await page.request.get(`/api/budgets/${M}`)).json();
      const today = new Date().getDate();
      for (const e of DEMO_EXPENSES) {
        const category = budget.categories.find((c: { name: string }) => c.name === e.category);
        await page.request.post("/api/expenses", {
          data: {
            categoryId: category.id,
            amountCents: e.amountCents,
            // Clamped: a date later than today is rejected (spec 019).
            spentOn: `${M}-${String(Math.min(e.day, today)).padStart(2, "0")}`,
            description: e.description,
          },
        });
      }
      for (const [name, at] of [["overview-spend", "/"], ["expenses-spend", "/expenses"], ["budget-spend", "/budget"]] as const) {
        await page.goto(at);
        await waitHydrated(page);
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(OUT, `${name}-${scheme}-${info.project.name}.png`), fullPage: true });
      }
      // Viewport only, unlike every other shot here: a full-page phone capture
      // is a 12,000px column, no use for showing what the app looks like.
      if (info.project.name === "phone") {
        await page.goto("/");
        await waitHydrated(page);
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(OUT, `overview-spend-phone-screen-${scheme}.png`) });
      }
    });
  });
}
