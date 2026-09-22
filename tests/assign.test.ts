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

async function createGoal(cookie: string, name: string, type: "saving" | "debt payoff") {
  const r = await call(goalsRoute.POST, "/api/goals", {
    method: "POST",
    cookie,
    body: { name, type },
  });
  expect(r.status).toBe(201);
  return (r.json.goal as { id: string }).id;
}

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

async function assignGoal(cookie: string, goalId: unknown, month = "2026-09") {
  return call(assignRoute.POST, `/api/budgets/${month}/assign-unallocated`, {
    method: "POST",
    cookie,
    params: { month },
    body: { goalId },
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

// Raw POST with a categoryId in the body, to assert the named 400.
async function assignCategory(cookie: string, body: unknown, month = "2026-09") {
  return call(assignRoute.POST, `/api/budgets/${month}/assign-unallocated`, {
    method: "POST",
    cookie,
    params: { month },
    body,
  });
}

beforeEach(async () => {
  clock.month = "2026-09";
  await getSql()`truncate "user", households, invites, verification cascade`;
});

describe("assign unallocated to a goal", () => {
  it("moves the whole unallocated amount into the goal, from this month onward", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    await setBudget(owner, "Groceries", 100000);
    expect((await budget(owner)).json.unallocatedCents).toBe(300000);

    const savings = await goalIdOf(owner);
    const r = await assignGoal(owner, savings);
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({
      assignedCents: 300000,
      unallocatedCents: 0,
      assignments: [{ goalId: savings, assignedCents: 300000, amountCents: 300000 }],
    });

    expect(await goalAmountOf(owner, "Savings")).toBe(300000);
    expect(await amountOf(owner, "Groceries")).toBe(100000);
    const after = await budget(owner);
    expect(after.json).toMatchObject({ unallocatedCents: 0 });

    // Unlike an ordinary allocation, an assign is a one-month top-up (spec
    // 017): the next month reverts to what Savings had before this assign
    // (nothing, here), so its income isn't fully budgeted again.
    expect(await goalAmountOf(owner, "Savings", "2026-10")).toBe(0);
    expect((await budget(owner, "2026-10")).json.unallocatedCents).toBe(300000);
  });

  it("adds to the goal's existing amount", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    await setGoalAmount(owner, "Savings", 50000);
    await setBudget(owner, "Groceries", 100000);
    const r = await assignGoal(owner, await goalIdOf(owner));
    expect(r.json).toMatchObject({
      assignedCents: 250000,
      assignments: [{ assignedCents: 250000, amountCents: 300000 }],
    });
    expect(await goalAmountOf(owner, "Savings")).toBe(300000);
  });

  it("stays editable afterwards (it is a normal allocation)", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    await assignGoal(owner, await goalIdOf(owner));
    await setGoalAmount(owner, "Savings", 100000);
    expect((await budget(owner)).json.unallocatedCents).toBe(300000);
  });

  it("does not overwrite an already-explicit amount for next month", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    await setGoalAmount(owner, "Savings", 20000, "2026-10"); // a deliberate plan for October
    await assignGoal(owner, await goalIdOf(owner));
    expect(await goalAmountOf(owner, "Savings", "2026-09")).toBe(400000);
    expect(await goalAmountOf(owner, "Savings", "2026-10")).toBe(20000); // untouched
    expect(await goalAmountOf(owner, "Savings", "2026-11")).toBe(20000); // inherits October's plan
  });

  it("rejects when there is nothing to assign (zero or over-allocated)", async () => {
    const owner = await setupOwner();
    const savings = await goalIdOf(owner);
    // No income at all.
    expect((await assignGoal(owner, savings)).status).toBe(400);
    // Fully allocated.
    await setIncome(owner, 100000);
    await setBudget(owner, "Groceries", 100000);
    expect((await assignGoal(owner, savings)).status).toBe(400);
    // Over-allocated.
    await setBudget(owner, "Groceries", 150000);
    const r = await assignGoal(owner, savings);
    expect(r.status).toBe(400);
    expect(r.json.error).toMatch(/no unallocated/);
    expect(await goalAmountOf(owner, "Savings")).toBe(0);
  });

  it("rejects past months", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    clock.month = "2026-10";
    const r = await assignGoal(owner, await goalIdOf(owner), "2026-09");
    expect(r.status).toBe(400);
    expect(r.json.error).toMatch(/read-only/);
  });

  it("rejects unknown, archived and malformed goals", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    expect((await assignGoal(owner, "00000000-0000-0000-0000-000000000000")).status).toBe(404);
    expect((await assignGoal(owner, "not-a-uuid")).status).toBe(404);
    expect((await assignGoal(owner, undefined)).status).toBe(400);
    expect((await assignGoal(owner, 42)).status).toBe(400);

    const savings = await goalIdOf(owner);
    await call(goalRoute.PATCH, `/api/goals/${savings}`, {
      method: "PATCH",
      cookie: owner,
      params: { id: savings },
      body: { archived: true },
    });
    expect((await assignGoal(owner, savings)).status).toBe(404);
    expect((await budget(owner)).json.unallocatedCents).toBe(400000);
  });

  it("never double-assigns when two requests race", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    await setBudget(owner, "Groceries", 100000);
    const savings = await goalIdOf(owner);
    const other = await createGoal(owner, "Vacation", "saving");

    const results = await Promise.all([
      assignGoal(owner, savings),
      assignGoal(owner, savings),
      assignGoal(owner, other),
      assignGoal(owner, savings),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400, 400, 400]);
    const after = await budget(owner);
    expect(after.json).toMatchObject({ unallocatedCents: 0 });
  });

  it("lets any household member assign, and rejects outsiders", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    const member = await joinAsMember(owner);
    const savings = await goalIdOf(owner);

    expect((await assignGoal(undefined as unknown as string, savings)).status).toBe(401);

    await getDb().transaction((tx) =>
      insertUserWithPassword(tx, { name: "Stranger", email: "stranger@example.com", password: "stranger password" }),
    );
    const stranger = cookieOf(await signInResponse("stranger@example.com", "stranger password", new Headers()));
    expect((await assignGoal(stranger, savings)).status).toBe(403);

    expect((await assignGoal(member.cookie, savings)).status).toBe(200);
    expect(await goalAmountOf(owner, "Savings")).toBe(400000);
  });
});

describe("splitting across several goals", () => {
  async function fundedOwner() {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    await setBudget(owner, "Groceries", 100000); // 300000 unallocated
    return owner;
  }

  it("assigns to several goals in one request", async () => {
    const owner = await fundedOwner();
    const savings = await goalIdOf(owner);
    const vacation = await createGoal(owner, "Vacation", "saving");
    const debt = await createGoal(owner, "Credit card", "debt payoff");
    const r = await assignMany(owner, [
      { goalId: savings, amountCents: 150000 },
      { goalId: vacation, amountCents: 100000 },
      { goalId: debt, amountCents: 50000 },
    ]);
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ assignedCents: 300000, unallocatedCents: 0 });
    expect((r.json.assignments as unknown[]).length).toBe(3);

    expect(await goalAmountOf(owner, "Savings")).toBe(150000);
    expect(await goalAmountOf(owner, "Vacation")).toBe(100000);
    expect(await goalAmountOf(owner, "Credit card")).toBe(50000);
    expect((await budget(owner)).json).toMatchObject({ unallocatedCents: 0 });
    // Each reverts to its pre-assign amount next month (spec 017), not 0
    // across the board — Savings and the two new goals all started at 0.
    expect(await goalAmountOf(owner, "Vacation", "2026-10")).toBe(0);
    expect(await goalAmountOf(owner, "Savings", "2026-10")).toBe(0);
  });

  it("adds to existing amounts and can leave the rest unallocated", async () => {
    const owner = await fundedOwner();
    await setGoalAmount(owner, "Savings", 50000); // unallocated now 250000
    const vacation = await createGoal(owner, "Vacation", "saving");
    const r = await assignMany(owner, [
      { goalId: await goalIdOf(owner), amountCents: 100000 },
      { goalId: vacation, amountCents: 50000 },
    ]);
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ assignedCents: 150000, unallocatedCents: 100000 });
    expect(await goalAmountOf(owner, "Savings")).toBe(150000);
    expect(await goalAmountOf(owner, "Vacation")).toBe(50000);
    expect((await budget(owner)).json.unallocatedCents).toBe(100000);
  });

  it("applies nothing when the total is more than the unallocated amount", async () => {
    const owner = await fundedOwner();
    const savings = await goalIdOf(owner);
    const vacation = await createGoal(owner, "Vacation", "saving");
    const r = await assignMany(owner, [
      { goalId: savings, amountCents: 200000 },
      { goalId: vacation, amountCents: 100001 },
    ]);
    expect(r.status).toBe(400);
    expect(r.json.error).toMatch(/more than the unallocated/);
    expect(await goalAmountOf(owner, "Savings")).toBe(0);
    expect(await goalAmountOf(owner, "Vacation")).toBe(0);
  });

  it("applies nothing when any one goal is invalid", async () => {
    const owner = await fundedOwner();
    const savings = await goalIdOf(owner);
    const r = await assignMany(owner, [
      { goalId: savings, amountCents: 100000 },
      { goalId: "00000000-0000-0000-0000-000000000000", amountCents: 100000 },
    ]);
    expect(r.status).toBe(404);
    expect(await goalAmountOf(owner, "Savings")).toBe(0);
    expect((await budget(owner)).json.unallocatedCents).toBe(300000);
  });

  it("rejects malformed requests", async () => {
    const owner = await fundedOwner();
    const savings = await goalIdOf(owner);
    const vacation = await createGoal(owner, "Vacation", "saving");
    const bad: unknown[] = [
      [],
      "nope",
      [{ goalId: savings, amountCents: 0 }],
      [{ goalId: savings, amountCents: -5 }],
      [{ goalId: savings, amountCents: 10.5 }],
      [{ goalId: savings, amountCents: "100" }],
      [{ goalId: savings }],
      [{ amountCents: 100 }],
      [null],
      [{ goalId: savings, amountCents: 100 }, { goalId: savings, amountCents: 100 }],
      Array.from({ length: 51 }, () => ({ goalId: vacation, amountCents: 1 })),
    ];
    for (const assignments of bad) {
      expect((await assignMany(owner, assignments)).status).toBe(400);
    }
    expect((await budget(owner)).json.unallocatedCents).toBe(300000);
  });

  it("rejects splits in past months and when nothing is unallocated", async () => {
    const owner = await fundedOwner();
    const savings = await goalIdOf(owner);
    expect((await assignGoal(owner, savings)).status).toBe(200); // uses it all
    expect((await assignMany(owner, [{ goalId: savings, amountCents: 1 }])).status).toBe(400);

    clock.month = "2026-10";
    const r = await assignMany(owner, [{ goalId: savings, amountCents: 1 }], "2026-09");
    expect(r.status).toBe(400);
    expect(r.json.error).toMatch(/read-only/);
  });

  it("never lets simultaneous splits assign the same money twice", async () => {
    const owner = await fundedOwner();
    const savings = await goalIdOf(owner);
    const vacation = await createGoal(owner, "Vacation", "saving");
    const results = await Promise.all([
      assignMany(owner, [{ goalId: savings, amountCents: 200000 }, { goalId: vacation, amountCents: 100000 }]),
      assignMany(owner, [{ goalId: savings, amountCents: 200000 }, { goalId: vacation, amountCents: 100000 }]),
      assignGoal(owner, savings),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400, 400]);
    expect((await budget(owner)).json).toMatchObject({ unallocatedCents: 0 });
  });

  it("requires a signed-in household member", async () => {
    const owner = await fundedOwner();
    const savings = await goalIdOf(owner);
    expect((await assignMany(undefined, [{ goalId: savings, amountCents: 1 }])).status).toBe(401);
    const member = await joinAsMember(owner);
    expect((await assignMany(member.cookie, [{ goalId: savings, amountCents: 100000 }])).status).toBe(200);
  });
});

describe("rejecting the removed category target (spec 020)", () => {
  async function fundedOwner() {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    await setBudget(owner, "Groceries", 100000); // 300000 unallocated
    return owner;
  }

  it("rejects a top-level categoryId with a message naming Expenses", async () => {
    const owner = await fundedOwner();
    const groceries = await idOf(owner, "Groceries");
    const r = await assignCategory(owner, { categoryId: groceries });
    expect(r.status).toBe(400);
    expect(r.json.error).toMatch(/log an Expense against the category instead/);
    expect((await budget(owner)).json.unallocatedCents).toBe(300000);
  });

  it("rejects a categoryId inside assignments, even alongside a valid goalId", async () => {
    const owner = await fundedOwner();
    const groceries = await idOf(owner, "Groceries");
    const savings = await goalIdOf(owner);
    const r = await assignMany(owner, [
      { goalId: savings, amountCents: 100000 },
      { categoryId: groceries, amountCents: 100000 },
    ]);
    expect(r.status).toBe(400);
    expect(r.json.error).toMatch(/log an Expense against the category instead/);
    // Nothing was applied.
    expect(await goalAmountOf(owner, "Savings")).toBe(0);
    expect((await budget(owner)).json.unallocatedCents).toBe(300000);
  });
});

describe("one-month top-up (spec 017)", () => {
  it("reverts a goal to its pre-assign amount next month, and later months inherit that", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    await setGoalAmount(owner, "Savings", 50000);
    await assignGoal(owner, await goalIdOf(owner)); // Savings: 50000 -> 400000
    expect(await goalAmountOf(owner, "Savings", "2026-09")).toBe(400000);
    expect(await goalAmountOf(owner, "Savings", "2026-10")).toBe(50000);
    expect(await goalAmountOf(owner, "Savings", "2026-11")).toBe(50000); // inherits October
  });

  it("a second assign to the same goal in the same month still reverts to the true original amount, not the intermediate one", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 900000);
    await setGoalAmount(owner, "Savings", 50000);
    const savings = await goalIdOf(owner);

    await assignMany(owner, [{ goalId: savings, amountCents: 100000 }]); // 50000 -> 150000
    expect(await goalAmountOf(owner, "Savings", "2026-10")).toBe(50000); // reverted already

    await assignMany(owner, [{ goalId: savings, amountCents: 200000 }]); // 150000 -> 350000
    expect(await goalAmountOf(owner, "Savings", "2026-09")).toBe(350000);
    // Still 50000, not 150000 — the second assign's revert write found
    // October already occupied by the first and left it alone.
    expect(await goalAmountOf(owner, "Savings", "2026-10")).toBe(50000);
  });

  it("does not affect a manual edit, which still carries forward onward", async () => {
    const owner = await setupOwner();
    await setGoalAmount(owner, "Savings", 40000);
    expect(await goalAmountOf(owner, "Savings", "2026-10")).toBe(40000);
    expect(await goalAmountOf(owner, "Savings", "2026-11")).toBe(40000);
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
