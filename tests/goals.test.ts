import { beforeEach, describe, expect, it, vi } from "vitest";

// Control "today" so tests can move between months.
const clock = vi.hoisted(() => ({ month: "2026-09" }));
vi.mock("@/lib/months", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/months")>()),
  currentMonth: () => clock.month,
}));

import * as goalRoute from "@/app/api/goals/[id]/route";
import * as goalAmountRoute from "@/app/api/goals/month/[month]/amounts/[id]/route";
import * as goalCheckinRoute from "@/app/api/goals/month/[month]/checkins/[id]/route";
import * as goalMonthRoute from "@/app/api/goals/month/[month]/route";
import * as goalsRoute from "@/app/api/goals/route";
import { getDb, getSql } from "@/db";
import { goals } from "@/db/schema";
import { insertUserWithPassword, signInResponse } from "@/lib/accounts";
import { call, cookieOf, joinAsMember, setupOwner } from "./helpers";

type GoalLine = { id: string; name: string; type: string; amountCents: number; checked: boolean };

async function goalsMonth(cookie: string, month = "2026-09") {
  const r = await call(goalMonthRoute.GET, `/api/goals/month/${month}`, { cookie, params: { month } });
  return { ...r, lines: (r.json.goals ?? []) as GoalLine[] };
}

async function idOf(cookie: string, name: string) {
  const r = await call(goalsRoute.GET, "/api/goals", { cookie });
  return (r.json.goals as { id: string; name: string }[]).find((g) => g.name === name)!.id;
}

async function addGoal(cookie: string, name: string, type = "saving") {
  return call(goalsRoute.POST, "/api/goals", { method: "POST", cookie, body: { name, type } });
}

async function patchGoal(cookie: string, id: string, body: unknown) {
  return call(goalRoute.PATCH, `/api/goals/${id}`, { method: "PATCH", cookie, params: { id }, body });
}

async function setAmount(cookie: string, month: string, goalId: string, amountCents: unknown) {
  return call(goalAmountRoute.PUT, `/api/goals/month/${month}/amounts/${goalId}`, {
    method: "PUT", cookie, params: { month, id: goalId }, body: { amountCents },
  });
}

async function setChecked(cookie: string, month: string, goalId: string, checked: unknown) {
  return call(goalCheckinRoute.PUT, `/api/goals/month/${month}/checkins/${goalId}`, {
    method: "PUT", cookie, params: { month, id: goalId }, body: { checked },
  });
}

const amountIn = async (cookie: string, month: string, name: string) =>
  (await goalsMonth(cookie, month)).lines.find((l) => l.name === name)?.amountCents;

const checkedIn = async (cookie: string, month: string, name: string) =>
  (await goalsMonth(cookie, month)).lines.find((l) => l.name === name)?.checked;

beforeEach(async () => {
  clock.month = "2026-09";
  await getSql()`truncate "user", households, invites, verification cascade`;
});

describe("setup", () => {
  it("creates a single starter Savings goal, at $0, unchecked", async () => {
    const cookie = await setupOwner();
    const { lines } = await goalsMonth(cookie, "2026-09");
    expect(lines).toEqual([
      { id: expect.any(String), name: "Savings", type: "saving", amountCents: 0, checked: false },
    ]);
  });
});

describe("goal CRUD", () => {
  it("creates a goal with a required type", async () => {
    const cookie = await setupOwner();
    const created = await addGoal(cookie, "Roth IRA", "saving");
    expect(created.status).toBe(201);
    expect((created.json.goal as { type: string }).type).toBe("saving");

    const noType = await call(goalsRoute.POST, "/api/goals", { method: "POST", cookie, body: { name: "No type" } });
    expect(noType.status).toBe(400);
    expect((await addGoal(cookie, "Bad type", "vibes")).status).toBe(400);
  });

  it("enforces unique names case-insensitively, but lets archived names be reused", async () => {
    const cookie = await setupOwner();
    expect((await addGoal(cookie, "savings")).status).toBe(409); // clashes with the starter goal
    expect((await addGoal(cookie, "Credit card", "debt payoff")).status).toBe(201);

    const savings = await idOf(cookie, "Savings");
    await patchGoal(cookie, savings, { archived: true });
    expect((await addGoal(cookie, "Savings")).status).toBe(201);
  });

  it("renames and retypes without versioning (unlike the amount)", async () => {
    const cookie = await setupOwner();
    const savings = await idOf(cookie, "Savings");
    expect((await patchGoal(cookie, savings, { name: "Vacation fund", type: "debt payoff" })).status).toBe(204);
    const now = (await goalsMonth(cookie, "2026-09")).lines.find((l) => l.id === savings);
    const later = (await goalsMonth(cookie, "2026-12")).lines.find((l) => l.id === savings);
    expect(now).toMatchObject({ name: "Vacation fund", type: "debt payoff" });
    expect(later).toMatchObject({ name: "Vacation fund", type: "debt payoff" });
  });

  it("hides an archived goal from this month on, but not from history, and never hard-deletes", async () => {
    const cookie = await setupOwner();
    const savings = await idOf(cookie, "Savings");
    await setAmount(cookie, "2026-09", savings, 50000);

    clock.month = "2026-10";
    expect((await patchGoal(cookie, savings, { archived: true })).status).toBe(204);
    expect(await amountIn(cookie, "2026-09", "Savings")).toBe(50000);
    expect(await amountIn(cookie, "2026-10", "Savings")).toBeUndefined();
    expect((await setAmount(cookie, "2026-10", savings, 1)).status).toBe(404);

    await patchGoal(cookie, savings, { archived: false });
    expect(await amountIn(cookie, "2026-10", "Savings")).toBe(50000);

    const rows = await getDb().select().from(goals);
    expect(rows.find((r) => r.id === savings)).toBeDefined();
  });

  it("reorders active goals", async () => {
    const cookie = await setupOwner();
    await addGoal(cookie, "Roth IRA", "saving");
    await addGoal(cookie, "Credit card", "debt payoff");
    const roth = await idOf(cookie, "Roth IRA");
    expect((await patchGoal(cookie, roth, { position: 0 })).status).toBe(204);
    const names = (await goalsMonth(cookie, "2026-09")).lines.map((l) => l.name);
    expect(names[0]).toBe("Roth IRA");
  });

  it("validates patch bodies", async () => {
    const cookie = await setupOwner();
    const savings = await idOf(cookie, "Savings");
    expect((await patchGoal(cookie, savings, {})).status).toBe(400);
    expect((await patchGoal(cookie, savings, { archived: "yes" })).status).toBe(400);
    expect((await patchGoal(cookie, savings, { position: -1 })).status).toBe(400);
    expect((await patchGoal(cookie, savings, { type: "vibes" })).status).toBe(400);
    const missing = "00000000-0000-0000-0000-000000000000";
    expect((await patchGoal(cookie, missing, { name: "x" })).status).toBe(404);
  });
});

describe("time-versioned amounts", () => {
  it("carries an amount into later months", async () => {
    const cookie = await setupOwner();
    const savings = await idOf(cookie, "Savings");
    expect((await setAmount(cookie, "2026-09", savings, 50000)).status).toBe(200);
    expect(await amountIn(cookie, "2026-09", "Savings")).toBe(50000);
    expect(await amountIn(cookie, "2026-10", "Savings")).toBe(50000);
    expect(await amountIn(cookie, "2027-03", "Savings")).toBe(50000);
  });

  it("leaves earlier months unchanged when a future month changes", async () => {
    const cookie = await setupOwner();
    const savings = await idOf(cookie, "Savings");
    await setAmount(cookie, "2026-09", savings, 50000);
    await setAmount(cookie, "2026-11", savings, 60000);
    expect(await amountIn(cookie, "2026-09", "Savings")).toBe(50000);
    expect(await amountIn(cookie, "2026-10", "Savings")).toBe(50000);
    expect(await amountIn(cookie, "2026-11", "Savings")).toBe(60000);
  });

  it("is read-only in the past", async () => {
    const cookie = await setupOwner();
    const savings = await idOf(cookie, "Savings");
    await setAmount(cookie, "2026-09", savings, 50000);
    clock.month = "2026-10";
    const r = await setAmount(cookie, "2026-09", savings, 1);
    expect(r.status).toBe(400);
    expect(r.json.error).toMatch(/read-only/);
  });

  it.each([
    ["negative", -1],
    ["fractional", 12.5],
    ["a string", "500"],
    ["too large", 2_000_000_001],
  ])("rejects an amount that is %s", async (_label, value) => {
    const cookie = await setupOwner();
    const savings = await idOf(cookie, "Savings");
    expect((await setAmount(cookie, "2026-09", savings, value)).status).toBe(400);
  });

  it("sums saving and debt payoff amounts separately", async () => {
    const cookie = await setupOwner();
    await addGoal(cookie, "Roth IRA", "saving");
    await addGoal(cookie, "Credit card", "debt payoff");
    await setAmount(cookie, "2026-09", await idOf(cookie, "Savings"), 30000);
    await setAmount(cookie, "2026-09", await idOf(cookie, "Roth IRA"), 20000);
    await setAmount(cookie, "2026-09", await idOf(cookie, "Credit card"), 15000);

    const { json } = await goalsMonth(cookie, "2026-09");
    expect(json).toMatchObject({ totalCents: 65000, savingCents: 50000, debtPayoffCents: 15000 });
  });
});

describe("checkins (spec 014)", () => {
  it("checks and unchecks a goal for a month", async () => {
    const cookie = await setupOwner();
    const savings = await idOf(cookie, "Savings");
    expect(await checkedIn(cookie, "2026-09", "Savings")).toBe(false);

    expect((await setChecked(cookie, "2026-09", savings, true)).status).toBe(200);
    expect(await checkedIn(cookie, "2026-09", "Savings")).toBe(true);

    expect((await setChecked(cookie, "2026-09", savings, false)).status).toBe(200);
    expect(await checkedIn(cookie, "2026-09", "Savings")).toBe(false);
  });

  it("is independent per month", async () => {
    const cookie = await setupOwner();
    const savings = await idOf(cookie, "Savings");
    await setChecked(cookie, "2026-09", savings, true);
    expect(await checkedIn(cookie, "2026-10", "Savings")).toBe(false);
  });

  it("can be set for a past month, unlike the amount", async () => {
    const cookie = await setupOwner();
    const savings = await idOf(cookie, "Savings");
    clock.month = "2026-10";
    const r = await setChecked(cookie, "2026-09", savings, true);
    expect(r.status).toBe(200);
    expect(await checkedIn(cookie, "2026-09", "Savings")).toBe(true);
  });

  it("rejects a non-boolean checked value", async () => {
    const cookie = await setupOwner();
    const savings = await idOf(cookie, "Savings");
    expect((await setChecked(cookie, "2026-09", savings, "yes")).status).toBe(400);
  });

  it("404s for an unknown goal", async () => {
    const cookie = await setupOwner();
    const missing = "00000000-0000-0000-0000-000000000000";
    expect((await setChecked(cookie, "2026-09", missing, true)).status).toBe(404);
  });
});

describe("access control", () => {
  it("rejects signed-out requests to every goal route", async () => {
    await setupOwner();
    const id = "00000000-0000-0000-0000-000000000000";
    const results = await Promise.all([
      call(goalsRoute.GET, "/api/goals"),
      call(goalsRoute.POST, "/api/goals", { method: "POST", body: { name: "x", type: "saving" } }),
      call(goalRoute.PATCH, `/api/goals/${id}`, { method: "PATCH", params: { id }, body: { name: "x" } }),
      call(goalMonthRoute.GET, "/api/goals/month/2026-09", { params: { month: "2026-09" } }),
      call(goalAmountRoute.PUT, `/api/goals/month/2026-09/amounts/${id}`, {
        method: "PUT", params: { month: "2026-09", id }, body: { amountCents: 1 },
      }),
      call(goalCheckinRoute.PUT, `/api/goals/month/2026-09/checkins/${id}`, {
        method: "PUT", params: { month: "2026-09", id }, body: { checked: true },
      }),
    ]);
    expect(results.map((r) => r.status)).toEqual(Array(6).fill(401));
  });

  it("rejects a signed-in user who is not a household member", async () => {
    await setupOwner();
    await getDb().transaction((tx) =>
      insertUserWithPassword(tx, { name: "Stranger", email: "stranger@example.com", password: "stranger password" }),
    );
    const cookie = cookieOf(await signInResponse("stranger@example.com", "stranger password", new Headers()));
    expect((await call(goalsRoute.GET, "/api/goals", { cookie })).status).toBe(403);
  });

  it("lets regular members manage goals", async () => {
    const owner = await setupOwner();
    const { cookie } = await joinAsMember(owner);
    expect((await addGoal(cookie, "Roth IRA", "saving")).status).toBe(201);
    const roth = await idOf(cookie, "Roth IRA");
    expect((await setAmount(cookie, "2026-09", roth, 2500)).status).toBe(200);
    expect(await amountIn(owner, "2026-09", "Roth IRA")).toBe(2500);
    expect((await setChecked(cookie, "2026-09", roth, true)).status).toBe(200);
    expect((await patchGoal(cookie, roth, { archived: true })).status).toBe(204);
  });
});
