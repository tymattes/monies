import { request, type APIRequestContext } from "@playwright/test";
import postgres from "postgres";
import { E2E_ORIGIN, assertScratch, e2eDb } from "./db.mts";

export const OWNER = { name: "Olive Owner", email: "o@e2e.test", password: "password123" };
export const MEMBER = { name: "Mia Member", email: "m@e2e.test", password: "password123" };

// "YYYY-MM" for the current month plus an offset. The app uses the real clock,
// so tests compute months instead of hardcoding them.
export function monthKey(offset = 0) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Everything is in cents. The numbers are chosen so each interesting state
// exists: money left unallocated, one category over budget from its bills, and
// a yearly bill spread across the months.
export const SEED = {
  household: "The Seeds",
  salaryCents: 500000,
  freelanceCents: 100000,
  incomeCents: 600000,
  budgets: {
    Housing: 180000,
    Groceries: 70000,
    "Dining out": 30000,
    Transport: 50000,
    Utilities: 35000, // bills below add up to 42000: over budget by 7000
    Health: 20000,
    Entertainment: 15000,
    Other: 10000,
  } as Record<string, number>,
  // Saving/Debt payoff goals (spec 014), separate from the Expense budgets
  // above but still counted in budgetedCents/unallocatedCents below.
  goals: {
    Savings: 100000,
  } as Record<string, number>,
  categoriesBudgetedCents: 410000, // Expense categories only, e.g. the Overview's categories table
  budgetedCents: 510000, // Expense categories (410,000) + goals (100,000): the "Budgeted" figure
  // Unallocated = income − bills − expenses − checked goals (spec 022). The
  // seeded Savings goal is funded but unchecked, and there are no expenses, so
  // it is 600,000 − 194,599 = 405,401.
  unallocatedCents: 405401,
  bills: [
    { name: "Rent", amountCents: 150000, category: "Housing", paidWith: "Checking" },
    { name: "Phone", amountCents: 8000, category: "Utilities" },
    { name: "Electric", amountCents: 19000, category: "Utilities" },
    { name: "Water", amountCents: 6000, category: "Utilities" },
    { name: "Internet", amountCents: 9000, category: "Utilities" },
    { name: "Streaming", amountCents: 1599, category: "Entertainment" },
    { name: "Cloud storage", amountCents: 12000, intervalMonths: 12, category: "Other", note: "Yearly plan" },
  ],
  billsCents: 194599, // 1500 + 420 + 15.99 + 10 (the yearly bill spread)
};

// Monthly cost of a bill (charge divided by its billing period, rounded half up).
const monthly = (b: { amountCents: number; intervalMonths?: number }) => {
  const n = b.intervalMonths ?? 1;
  return Math.floor((b.amountCents + Math.floor(n / 2)) / n);
};

// What each category's Budgeted, Bills and Left should read for the seed data.
export function expectedCategoryRows() {
  return Object.entries(SEED.budgets).map(([name, budgeted]) => {
    const bills = SEED.bills.filter((b) => b.category === name).reduce((t, b) => t + monthly(b), 0);
    return { name, budgeted, bills, left: budgeted - bills };
  });
}

async function ok(res: Awaited<ReturnType<APIRequestContext["get"]>>, what: string) {
  if (!res.ok()) {
    throw new Error(`Seeding failed at ${what}: ${res.status()} ${await res.text()}`);
  }
  return res;
}

// Empties the scratch database and creates only the household and its owner
// (no income, budgets or bills), for the empty-state checks.
export async function resetEmpty() {
  const { e2eUrl, dbName } = e2eDb();
  assertScratch(dbName);
  const sql = postgres(e2eUrl, { max: 1, onnotice: () => {} });
  try {
    await sql`truncate "user", households, invites, verification cascade`;
  } finally {
    await sql.end();
  }
  const owner = await request.newContext({ baseURL: E2E_ORIGIN, extraHTTPHeaders: { origin: E2E_ORIGIN } });
  try {
    await ok(await owner.post("/api/setup", { data: { householdName: SEED.household, currency: "USD", ...OWNER } }), "setup");
  } finally {
    await owner.dispose();
  }
}

// The same household without the variable (freelance) source: its income is
// complete, so being over-committed is a real error rather than "deposits not
// recorded yet" (spec 010). A bill is added to push bills past income by
// exactly the amount below (spec 022: over-allocated means real commitments
// exceed income, not that budgeted amounts do).
export const FIXED_ONLY = {
  incomeCents: 500000,
  overAllocatedCents: 100000,
};

export const resetAndSeed = () => seedHousehold(true);
export const resetAndSeedFixedOnly = () => seedHousehold(false);

// Empties the scratch database and rebuilds the household through the app's
// own API. Refuses to touch anything that is not a scratch database.
async function seedHousehold(withVariable: boolean) {
  const { e2eUrl, dbName } = e2eDb();
  assertScratch(dbName);
  const sql = postgres(e2eUrl, { max: 1, onnotice: () => {} });
  try {
    await sql`truncate "user", households, invites, verification cascade`;
  } finally {
    await sql.end();
  }

  const opts = { baseURL: E2E_ORIGIN, extraHTTPHeaders: { origin: E2E_ORIGIN } };
  const owner = await request.newContext(opts);
  const member = await request.newContext(opts);
  try {
    await ok(
      await owner.post("/api/setup", {
        data: { householdName: SEED.household, currency: "USD", ...OWNER },
      }),
      "setup",
    );
    const invite = (await (await ok(await owner.post("/api/invites", { data: {} }), "invite")).json()) as { token: string };
    await ok(await member.post(`/api/join/${invite.token}`, { data: MEMBER }), "join");

    const M = monthKey();
    const budget = (await (await ok(await owner.get(`/api/budgets/${M}`), "budget")).json()) as {
      categories: { id: string; name: string }[];
      goals: { id: string; name: string }[];
    };
    const category = (name: string): string => {
      const found = budget.categories.find((c) => c.name === name);
      if (!found) throw new Error(`Seeding: no category "${name}"`);
      return found.id;
    };
    const goal = (name: string): string => {
      const found = budget.goals.find((g) => g.name === name);
      if (!found) throw new Error(`Seeding: no goal "${name}"`);
      return found.id;
    };

    const salary = (await (await ok(await owner.post("/api/income/sources", { data: { name: "Salary", kind: "fixed" } }), "salary")).json()) as { source: { id: string } };
    await ok(await owner.put(`/api/income/${M}/sources/${salary.source.id}`, { data: { amountCents: SEED.salaryCents } }), "salary amount");
    if (withVariable) {
      const freelance = (await (await ok(await member.post("/api/income/sources", { data: { name: "Freelance", kind: "variable" } }), "freelance")).json()) as { source: { id: string } };
      await ok(
        await member.post(`/api/income/sources/${freelance.source.id}/deposits`, {
          data: { receivedOn: `${M}-01`, amountCents: SEED.freelanceCents, note: "Logo job" },
        }),
        "deposit",
      );
    }

    for (const [name, amountCents] of Object.entries(SEED.budgets)) {
      await ok(await owner.put(`/api/budgets/${M}/allocations/${category(name)}`, { data: { amountCents } }), `budget ${name}`);
    }
    for (const [name, amountCents] of Object.entries(SEED.goals)) {
      await ok(await owner.put(`/api/goals/month/${M}/amounts/${goal(name)}`, { data: { amountCents } }), `goal ${name}`);
    }
    for (const b of SEED.bills) {
      await ok(
        await owner.post("/api/bills", {
          data: { ...b, categoryId: category(b.category), category: undefined },
        }),
        `bill ${b.name}`,
      );
    }
    // The fixed-only household is over-committed: a bill that pushes bills
    // past income by FIXED_ONLY.overAllocatedCents (spec 022).
    if (!withVariable) {
      await ok(
        await owner.post("/api/bills", {
          data: {
            name: "Car loan",
            amountCents: FIXED_ONLY.incomeCents + FIXED_ONLY.overAllocatedCents - SEED.billsCents,
            categoryId: category("Transport"),
          },
        }),
        "over-committing bill",
      );
    }
  } finally {
    await owner.dispose();
    await member.dispose();
  }
}
