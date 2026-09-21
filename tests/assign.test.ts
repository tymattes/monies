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
import * as sourceAmountRoute from "@/app/api/income/[month]/sources/[id]/route";
import * as sourcesRoute from "@/app/api/income/sources/route";
import { getDb, getSql } from "@/db";
import { insertUserWithPassword, signInResponse } from "@/lib/accounts";
import { call, cookieOf, joinAsMember, setupOwner } from "./helpers";

type Line = { id: string; name: string; amountCents: number };

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

    const savings = await idOf(owner, "Savings");
    const r = await assign(owner, savings);
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ assignedCents: 300000, amountCents: 300000, unallocatedCents: 0 });

    expect(await amountOf(owner, "Savings")).toBe(300000);
    expect(await amountOf(owner, "Groceries")).toBe(100000);
    const after = await budget(owner);
    expect(after.json).toMatchObject({ totalCents: 400000, unallocatedCents: 0 });

    // An ordinary allocation: it carries forward like any other.
    expect(await amountOf(owner, "Savings", "2026-10")).toBe(300000);
    expect((await budget(owner, "2026-10")).json.unallocatedCents).toBe(0);
  });

  it("adds to the category's existing amount", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    await setBudget(owner, "Savings", 50000);
    await setBudget(owner, "Groceries", 100000);
    const r = await assign(owner, await idOf(owner, "Savings"));
    expect(r.json).toMatchObject({ assignedCents: 250000, amountCents: 300000 });
    expect(await amountOf(owner, "Savings")).toBe(300000);
  });

  it("stays editable afterwards (it is a normal allocation)", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    await assign(owner, await idOf(owner, "Savings"));
    await setBudget(owner, "Savings", 100000);
    expect((await budget(owner)).json.unallocatedCents).toBe(300000);
  });

  it("does not touch earlier or later explicit allocations", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    await setBudget(owner, "Savings", 20000, "2026-11");
    await assign(owner, await idOf(owner, "Savings"));
    expect(await amountOf(owner, "Savings", "2026-09")).toBe(400000);
    expect(await amountOf(owner, "Savings", "2026-10")).toBe(400000);
    expect(await amountOf(owner, "Savings", "2026-11")).toBe(20000);
  });

  it("rejects when there is nothing to assign (zero or over-allocated)", async () => {
    const owner = await setupOwner();
    const savings = await idOf(owner, "Savings");
    // No income at all.
    expect((await assign(owner, savings)).status).toBe(400);
    // Fully allocated.
    await setIncome(owner, 100000);
    await setBudget(owner, "Groceries", 100000);
    expect((await assign(owner, savings)).status).toBe(400);
    // Over-allocated.
    await setBudget(owner, "Groceries", 150000);
    const r = await assign(owner, savings);
    expect(r.status).toBe(400);
    expect(r.json.error).toMatch(/no unallocated/);
    expect(await amountOf(owner, "Savings")).toBe(0);
  });

  it("rejects past months", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    clock.month = "2026-10";
    const r = await assign(owner, await idOf(owner, "Savings", ), "2026-09");
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

    const savings = await idOf(owner, "Savings");
    await call(categoryRoute.PATCH, `/api/categories/${savings}`, {
      method: "PATCH",
      cookie: owner,
      params: { id: savings },
      body: { archived: true },
    });
    expect((await assign(owner, savings)).status).toBe(404);
    expect((await budget(owner)).json.unallocatedCents).toBe(400000);
  });

  it("never double-assigns when two requests race", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    await setBudget(owner, "Groceries", 100000);
    const savings = await idOf(owner, "Savings");
    const other = await idOf(owner, "Other");

    const results = await Promise.all([
      assign(owner, savings),
      assign(owner, savings),
      assign(owner, other),
      assign(owner, savings),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400, 400, 400]);
    const after = await budget(owner);
    expect(after.json).toMatchObject({ totalCents: 400000, unallocatedCents: 0 });
  });

  it("lets any household member assign, and rejects outsiders", async () => {
    const owner = await setupOwner();
    await setIncome(owner, 400000);
    const member = await joinAsMember(owner);
    const savings = await idOf(owner, "Savings");

    expect((await assign(undefined as unknown as string, savings)).status).toBe(401);

    await getDb().transaction((tx) =>
      insertUserWithPassword(tx, { name: "Stranger", email: "stranger@example.com", password: "stranger password" }),
    );
    const stranger = cookieOf(await signInResponse("stranger@example.com", "stranger password", new Headers()));
    expect((await assign(stranger, savings)).status).toBe(403);

    expect((await assign(member.cookie, savings)).status).toBe(200);
    expect(await amountOf(owner, "Savings")).toBe(400000);
  });
});
