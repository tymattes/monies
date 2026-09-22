import { beforeEach, describe, expect, it, vi } from "vitest";

// Control "today" so tests can move between months.
const clock = vi.hoisted(() => ({ month: "2026-09" }));
vi.mock("@/lib/months", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/months")>()),
  currentMonth: () => clock.month,
}));

import * as allocationRoute from "@/app/api/budgets/[month]/allocations/[categoryId]/route";
import * as assignRoute from "@/app/api/budgets/[month]/assign-unallocated/route";
import * as budgetRoute from "@/app/api/budgets/[month]/route";
import * as categoryRoute from "@/app/api/categories/[id]/route";
import * as goalRoute from "@/app/api/goals/[id]/route";
import * as goalAmountRoute from "@/app/api/goals/month/[month]/amounts/[id]/route";
import * as goalsRoute from "@/app/api/goals/route";
import * as sourceAmountRoute from "@/app/api/income/[month]/sources/[id]/route";
import * as sourcesRoute from "@/app/api/income/sources/route";
import { getDb, getSql } from "@/db";
import { insertUserWithPassword, signInResponse } from "@/lib/accounts";
import { call, cookieOf, joinAsMember, setupOwner } from "./helpers";

type Line = { id: string; name: string; amountCents: number };
type GoalLine = { id: string; name: string; amountCents: number };

async function budget(cookie: string, month = "2026-09") {
  const r = await call(budgetRoute.GET, `/api/budgets/${month}`, { cookie, params: { month } });
  return { ...r, lines: (r.json.categories ?? []) as Line[] };
}

const idOf = async (cookie: string, name: string) =>
  (await budget(cookie)).lines.find((l) => l.name === name)!.id;

const amountOf = async (cookie: string, name: string, month = "2026-09") =>
  (await budget(cookie, month)).lines.find((l) => l.name === name)?.amountCents;

async function setBudget(cookie: string, name: string, amountCents: number, month = "2026-09") {
  const categoryId = await idOf(cookie, name);
  const r = await call(allocationRoute.PUT, `/api/budgets/${month}/allocations/${categoryId}`, {
    method: "PUT",
    cookie,
    params: { month, categoryId },
    body: { amountCents },
  });
  expect(r.status).toBe(200);
}

// The Savings goal on the same budget response (spec 014) — always
// present, since it is seeded on setup.
const goalIdOf = async (cookie: string, name = "Savings") => {
  const r = await call(goalsRoute.GET, "/api/goals", { cookie });
  return (r.json.goals as GoalLine[]).find((g) => g.name === name)!.id;
};

const goalAmountOf = async (cookie: string, name: string, month = "2026-09") => {
  const r = await call(budgetRoute.GET, `/api/budgets/${month}`, { cookie, params: { month } });
  return (r.json.goals as GoalLine[]).find((g) => g.name === name)?.amountCents;
};

async function setGoalAmount(cookie: string, name: string, amountCents: number, month = "2026-09") {
  const goalId = await goalIdOf(cookie, name);
  const r = await call(goalAmountRoute.PUT, `/api/goals/month/${month}/amounts/${goalId}`, {
    method: "PUT",
    cookie,
    params: { month, id: goalId },
    body: { amountCents },
  });
  expect(r.status).toBe(200);
}

async function setIncome(cookie: string, amountCents: number, month = "2026-09") {
  const created = await call(sourcesRoute.POST, "/api/income/sources", {
    method: "POST",
    cookie,
    body: { name: "Salary", kind: "fixed" },
  });
  const id = (created.json.source as { id: string }).id;
  const r = await call(sourceAmountRoute.PUT, `/api/income/${month}/sources/${id}`, {
    method: "PUT",
    cookie,
    params: { month, id },
    body: { amountCents },
  });
  expect(r.status).toBe(200);
}

async function assign(cookie: string, categoryId: unknown, month = "2026-09") {
  return call(assignRoute.POST, `/api/budgets/${month}/assign-unallocated`, {
    method: "POST",
    cookie,
    params: { month },
    body: { categoryId },
  });
}

async function assignMany(cookie: string | undefined, assignments: unknown, month = "2026-09") {
  return call(assignRoute.POST, `/api/budgets/${month}/assign-unallocated`, {
    method: "POST",
    cookie,
    params: { month },
    body: { assignments },
  });
}

async function assignGoal(cookie: string, goalId: unknown, month = "2026-09") {
  return call(assignRoute.POST, `/api/budgets/${month}/assign-unallocated`, {
    method: "POST",
    cookie,
    params: { month },
    body: { goalId },
  });
}

beforeEach(async () => {
  clock.month = "2026-09";
  await getSql()`truncate "user", households, invites, verification cascade`;
});

describe("assign unallocated", () => {
  it("moves the whole unallocated amount into the category, from this month onward", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    await setBudget(owner, "Groceries", 100000);
    expect((await budget(owner)).json.unallocatedCents).toBe(300000);

    const housing = await idOf(owner, "Housing");
    const r = await assign(owner, housing);
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({
      assignedCents: 300000,
      unallocatedCents: 0,
      assignments: [{ categoryId: housing, assignedCents: 300000, amountCents: 300000 }],
    });

    expect(await amountOf(owner, "Housing")).toBe(300000);
    expect(await amountOf(owner, "Groceries")).toBe(100000);
    const after = await budget(owner);
    expect(after.json).toMatchObject({ totalCents: 400000, unallocatedCents: 0 });

    // Unlike an ordinary allocation, an assign is a one-month top-up (spec
    // 017): the next month reverts to what Housing had before this assign
    // (nothing, here), so its income isn't fully budgeted again.
    expect(await amountOf(owner, "Housing", "2026-10")).toBe(0);
    expect((await budget(owner, "2026-10")).json.unallocatedCents).toBe(300000);
  });

  it("adds to the category's existing amount", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    await setBudget(owner, "Housing", 50000);
    await setBudget(owner, "Groceries", 100000);
    const r = await assign(owner, await idOf(owner, "Housing"));
    expect(r.json).toMatchObject({
      assignedCents: 250000,
      assignments: [{ assignedCents: 250000, amountCents: 300000 }],
    });
    expect(await amountOf(owner, "Housing")).toBe(300000);
  });

  it("stays editable afterwards (it is a normal allocation)", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    await assign(owner, await idOf(owner, "Housing"));
    await setBudget(owner, "Housing", 100000);
    expect((await budget(owner)).json.unallocatedCents).toBe(300000);
  });

  it("does not overwrite an already-explicit amount for next month", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    await setBudget(owner, "Housing", 20000, "2026-10"); // a deliberate plan for October
    await assign(owner, await idOf(owner, "Housing"));
    expect(await amountOf(owner, "Housing", "2026-09")).toBe(400000);
    expect(await amountOf(owner, "Housing", "2026-10")).toBe(20000); // untouched
    expect(await amountOf(owner, "Housing", "2026-11")).toBe(20000); // inherits October's plan
  });

  it("rejects when there is nothing to assign (zero or over-allocated)", async () => {
    const owner = await setupOwner();
    const housing = await idOf(owner, "Housing");
    // No income at all.
    expect((await assign(owner, housing)).status).toBe(400);
    // Fully allocated.
    await setIncome(owner, 100000);
    await setBudget(owner, "Groceries", 100000);
    expect((await assign(owner, housing)).status).toBe(400);
    // Over-allocated.
    await setBudget(owner, "Groceries", 150000);
    const r = await assign(owner, housing);
    expect(r.status).toBe(400);
    expect(r.json.error).toMatch(/no unallocated/);
    expect(await amountOf(owner, "Housing")).toBe(0);
  });

  it("rejects past months", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    clock.month = "2026-10";
    const r = await assign(owner, await idOf(owner, "Housing"), "2026-09");
    expect(r.status).toBe(400);
    expect(r.json.error).toMatch(/read-only/);
  });

  it("rejects unknown, archived and malformed categories", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    expect((await assign(owner, "00000000-0000-0000-0000-000000000000")).status).toBe(404);
    expect((await assign(owner, "not-a-uuid")).status).toBe(404);
    expect((await assign(owner, undefined)).status).toBe(400);
    expect((await assign(owner, 42)).status).toBe(400);

    const housing = await idOf(owner, "Housing");
    await call(categoryRoute.PATCH, `/api/categories/${housing}`, {
      method: "PATCH",
      cookie: owner,
      params: { id: housing },
      body: { archived: true },
    });
    expect((await assign(owner, housing)).status).toBe(404);
    expect((await budget(owner)).json.unallocatedCents).toBe(400000);
  });

  it("never double-assigns when two requests race", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    await setBudget(owner, "Groceries", 100000);
    const housing = await idOf(owner, "Housing");
    const other = await idOf(owner, "Other");

    const results = await Promise.all([
      assign(owner, housing),
      assign(owner, housing),
      assign(owner, other),
      assign(owner, housing),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400, 400, 400]);
    const after = await budget(owner);
    expect(after.json).toMatchObject({ totalCents: 400000, unallocatedCents: 0 });
  });

  it("lets any household member assign, and rejects outsiders", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    const member = await joinAsMember(owner);
    const housing = await idOf(owner, "Housing");

    expect((await assign(undefined as unknown as string, housing)).status).toBe(401);

    await getDb().transaction((tx) =>
      insertUserWithPassword(tx, { name: "Stranger", email: "stranger@example.com", password: "stranger password" }),
    );
    const stranger = cookieOf(await signInResponse("stranger@example.com", "stranger password", new Headers()));
    expect((await assign(stranger, housing)).status).toBe(403);

    expect((await assign(member.cookie, housing)).status).toBe(200);
    expect(await amountOf(owner, "Housing")).toBe(400000);
  });
});

describe("splitting across several categories", () => {
  async function fundedOwner() {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    await setBudget(owner, "Groceries", 100000); // 300000 unallocated
    return owner;
  }

  it("assigns to several categories in one request", async () => {
    const owner = await fundedOwner();
    const [housing, dining, other] = await Promise.all(["Housing", "Dining out", "Other"].map((n) => idOf(owner, n)));
    const r = await assignMany(owner, [
      { categoryId: housing, amountCents: 200000 },
      { categoryId: dining, amountCents: 60000 },
      { categoryId: other, amountCents: 40000 },
    ]);
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ assignedCents: 300000, unallocatedCents: 0 });
    expect((r.json.assignments as unknown[]).length).toBe(3);

    expect(await amountOf(owner, "Housing")).toBe(200000);
    expect(await amountOf(owner, "Dining out")).toBe(60000);
    expect(await amountOf(owner, "Other")).toBe(40000);
    expect((await budget(owner)).json).toMatchObject({ totalCents: 400000, unallocatedCents: 0 });
    // Each reverts to its pre-assign amount next month (spec 017), not 0
    // across the board — Groceries already had 100000 before any of this.
    expect(await amountOf(owner, "Dining out", "2026-10")).toBe(0);
    expect(await amountOf(owner, "Groceries", "2026-10")).toBe(100000);
  });

  it("adds to existing amounts and can leave the rest unallocated", async () => {
    const owner = await fundedOwner();
    await setBudget(owner, "Housing", 50000); // unallocated now 250000
    const housing = await idOf(owner, "Housing");
    const dining = await idOf(owner, "Dining out");
    const r = await assignMany(owner, [
      { categoryId: housing, amountCents: 100000 },
      { categoryId: dining, amountCents: 50000 },
    ]);
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ assignedCents: 150000, unallocatedCents: 100000 });
    expect(await amountOf(owner, "Housing")).toBe(150000);
    expect(await amountOf(owner, "Dining out")).toBe(50000);
    expect((await budget(owner)).json.unallocatedCents).toBe(100000);
  });

  it("applies nothing when the total is more than the unallocated amount", async () => {
    const owner = await fundedOwner();
    const housing = await idOf(owner, "Housing");
    const dining = await idOf(owner, "Dining out");
    const r = await assignMany(owner, [
      { categoryId: housing, amountCents: 200000 },
      { categoryId: dining, amountCents: 100001 },
    ]);
    expect(r.status).toBe(400);
    expect(r.json.error).toMatch(/more than the unallocated/);
    expect(await amountOf(owner, "Housing")).toBe(0);
    expect(await amountOf(owner, "Dining out")).toBe(0);
  });

  it("applies nothing when any one category is invalid", async () => {
    const owner = await fundedOwner();
    const housing = await idOf(owner, "Housing");
    const r = await assignMany(owner, [
      { categoryId: housing, amountCents: 100000 },
      { categoryId: "00000000-0000-0000-0000-000000000000", amountCents: 100000 },
    ]);
    expect(r.status).toBe(404);
    expect(await amountOf(owner, "Housing")).toBe(0);
    expect((await budget(owner)).json.unallocatedCents).toBe(300000);
  });

  it("rejects malformed requests", async () => {
    const owner = await fundedOwner();
    const housing = await idOf(owner, "Housing");
    const dining = await idOf(owner, "Dining out");
    const bad: unknown[] = [
      [],
      "nope",
      [{ categoryId: housing, amountCents: 0 }],
      [{ categoryId: housing, amountCents: -5 }],
      [{ categoryId: housing, amountCents: 10.5 }],
      [{ categoryId: housing, amountCents: "100" }],
      [{ categoryId: housing }],
      [{ amountCents: 100 }],
      [null],
      [{ categoryId: housing, amountCents: 100 }, { categoryId: housing, amountCents: 100 }],
      Array.from({ length: 51 }, () => ({ categoryId: dining, amountCents: 1 })),
    ];
    for (const assignments of bad) {
      expect((await assignMany(owner, assignments)).status).toBe(400);
    }
    expect((await budget(owner)).json.unallocatedCents).toBe(300000);
  });

  it("rejects splits in past months and when nothing is unallocated", async () => {
    const owner = await fundedOwner();
    const housing = await idOf(owner, "Housing");
    expect((await assign(owner, housing)).status).toBe(200); // uses it all
    expect((await assignMany(owner, [{ categoryId: housing, amountCents: 1 }])).status).toBe(400);

    clock.month = "2026-10";
    const r = await assignMany(owner, [{ categoryId: housing, amountCents: 1 }], "2026-09");
    expect(r.status).toBe(400);
    expect(r.json.error).toMatch(/read-only/);
  });

  it("never lets simultaneous splits assign the same money twice", async () => {
    const owner = await fundedOwner();
    const housing = await idOf(owner, "Housing");
    const dining = await idOf(owner, "Dining out");
    const results = await Promise.all([
      assignMany(owner, [{ categoryId: housing, amountCents: 200000 }, { categoryId: dining, amountCents: 100000 }]),
      assignMany(owner, [{ categoryId: housing, amountCents: 200000 }, { categoryId: dining, amountCents: 100000 }]),
      assign(owner, housing),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400, 400]);
    expect((await budget(owner)).json).toMatchObject({ totalCents: 400000, unallocatedCents: 0 });
  });

  it("requires a signed-in household member", async () => {
    const owner = await fundedOwner();
    const housing = await idOf(owner, "Housing");
    expect((await assignMany(undefined, [{ categoryId: housing, amountCents: 1 }])).status).toBe(401);
    const member = await joinAsMember(owner);
    expect((await assignMany(member.cookie, [{ categoryId: housing, amountCents: 100000 }])).status).toBe(200);
  });
});

describe("assigning to a goal (spec 014)", () => {
  it("moves the whole unallocated amount into a goal with the {goalId} shorthand", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    await setBudget(owner, "Housing", 100000);
    const savings = await goalIdOf(owner);

    const r = await assignGoal(owner, savings);
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({
      assignedCents: 300000,
      unallocatedCents: 0,
      assignments: [{ kind: "goal", goalId: savings, assignedCents: 300000, amountCents: 300000 }],
    });
    expect(await goalAmountOf(owner, "Savings")).toBe(300000);
    // A goal reverts to its pre-assign amount next month too (spec 017),
    // same as a category.
    expect(await goalAmountOf(owner, "Savings", "2026-10")).toBe(0);
  });

  it("adds to the goal's existing amount", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    await setGoalAmount(owner, "Savings", 50000);
    await setBudget(owner, "Housing", 100000);
    const savings = await goalIdOf(owner);
    const r = await assignGoal(owner, savings);
    expect(r.json).toMatchObject({
      assignedCents: 250000,
      assignments: [{ assignedCents: 250000, amountCents: 300000 }],
    });
    expect(await goalAmountOf(owner, "Savings")).toBe(300000);
  });

  it("mixes a category and a goal in one assignments request", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    await setBudget(owner, "Housing", 100000); // 300000 unallocated
    const housing = await idOf(owner, "Housing");
    const savings = await goalIdOf(owner);

    const r = await assignMany(owner, [
      { goalId: savings, amountCents: 200000 },
      { categoryId: housing, amountCents: 100000 },
    ]);
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ assignedCents: 300000, unallocatedCents: 0 });
    expect(await goalAmountOf(owner, "Savings")).toBe(200000);
    expect(await amountOf(owner, "Housing")).toBe(200000); // 100000 + 100000
  });

  it("rejects an unknown or archived goal", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    expect((await assignGoal(owner, "00000000-0000-0000-0000-000000000000")).status).toBe(404);

    const savings = await goalIdOf(owner);
    await call(goalRoute.PATCH, `/api/goals/${savings}`, {
      method: "PATCH",
      cookie: owner,
      params: { id: savings },
      body: { archived: true },
    });
    expect((await assignGoal(owner, savings)).status).toBe(404);
  });

  it("rejects past months, same as a category", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    const savings = await goalIdOf(owner);
    clock.month = "2026-10";
    const r = await assignGoal(owner, savings, "2026-09");
    expect(r.status).toBe(400);
    expect(r.json.error).toMatch(/read-only/);
  });

  it("counts a goal's committed amount in Unallocated everywhere (spec 014)", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    await setGoalAmount(owner, "Savings", 100000);
    await setBudget(owner, "Housing", 50000);
    const b = await budget(owner);
    // 400,000 income - 100,000 goal - 50,000 category = 250,000 unallocated.
    expect(b.json.unallocatedCents).toBe(250000);
  });
});

describe("one-month top-up (spec 017)", () => {
  it("reverts a category to its pre-assign amount next month, and later months inherit that", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    await setBudget(owner, "Housing", 50000);
    await assign(owner, await idOf(owner, "Housing")); // Housing: 50000 -> 400000
    expect(await amountOf(owner, "Housing", "2026-09")).toBe(400000);
    expect(await amountOf(owner, "Housing", "2026-10")).toBe(50000);
    expect(await amountOf(owner, "Housing", "2026-11")).toBe(50000); // inherits October
  });

  it("reverts a goal the same way", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    await setGoalAmount(owner, "Savings", 20000);
    await assignGoal(owner, await goalIdOf(owner)); // Savings: 20000 -> 400000
    expect(await goalAmountOf(owner, "Savings", "2026-09")).toBe(400000);
    expect(await goalAmountOf(owner, "Savings", "2026-10")).toBe(20000);
    expect(await goalAmountOf(owner, "Savings", "2026-11")).toBe(20000);
  });

  it("a second assign to the same target in the same month still reverts to the true original amount, not the intermediate one", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 900000);
    await setBudget(owner, "Housing", 50000);
    const housing = await idOf(owner, "Housing");

    await assignMany(owner, [{ categoryId: housing, amountCents: 100000 }]); // 50000 -> 150000
    expect(await amountOf(owner, "Housing", "2026-10")).toBe(50000); // reverted already

    await assignMany(owner, [{ categoryId: housing, amountCents: 200000 }]); // 150000 -> 350000
    expect(await amountOf(owner, "Housing", "2026-09")).toBe(350000);
    // Still 50000, not 150000 — the second assign's revert write found
    // October already occupied by the first and left it alone.
    expect(await amountOf(owner, "Housing", "2026-10")).toBe(50000);
  });

  it("does not affect a manual edit, which still carries forward onward", async () => {
    const owner = await setupOwner();
    await setBudget(owner, "Housing", 40000);
    expect(await amountOf(owner, "Housing", "2026-10")).toBe(40000);
    expect(await amountOf(owner, "Housing", "2026-11")).toBe(40000);
  });
});
