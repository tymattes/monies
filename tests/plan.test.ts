import { beforeEach, describe, expect, it, vi } from "vitest";

// Control "today" so tests can move between months.
const clock = vi.hoisted(() => ({ month: "2026-09" }));
vi.mock("@/lib/months", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/months")>()),
  currentMonth: () => clock.month,
}));

import * as allocationRoute from "@/app/api/budgets/[month]/allocations/[categoryId]/route";
import * as budgetRoute from "@/app/api/budgets/[month]/route";
import * as billsRoute from "@/app/api/bills/route";
import * as goalAmountRoute from "@/app/api/goals/month/[month]/amounts/[id]/route";
import * as goalsRoute from "@/app/api/goals/route";
import * as incomeAmountRoute from "@/app/api/income/[month]/sources/[id]/route";
import * as incomeSourcesRoute from "@/app/api/income/sources/route";
import { getSql } from "@/db";
import { getHouseholdContext } from "@/lib/household";
import { getPlanSummary } from "@/lib/plan";
import { call, setupOwner } from "./helpers";

async function ctxFor(cookie: string) {
  const ctx = await getHouseholdContext(new Headers({ cookie }));
  if (!ctx) throw new Error("no household context");
  return ctx;
}

async function categoryId(cookie: string, name: string) {
  const r = await call(budgetRoute.GET, "/api/budgets/2026-09", { cookie, params: { month: "2026-09" } });
  return (r.json.categories as { id: string; name: string }[]).find((c) => c.name === name)!.id;
}

async function budget(cookie: string, name: string, amountCents: number) {
  const id = await categoryId(cookie, name);
  const r = await call(allocationRoute.PUT, `/api/budgets/2026-09/allocations/${id}`, {
    method: "PUT", cookie, params: { month: "2026-09", categoryId: id }, body: { amountCents },
  });
  expect(r.status).toBe(200);
}

async function income(cookie: string, amountCents: number) {
  const created = await call(incomeSourcesRoute.POST, "/api/income/sources", { method: "POST", cookie, body: { name: "Salary", kind: "fixed" } });
  const id = (created.json.source as { id: string }).id;
  const r = await call(incomeAmountRoute.PUT, `/api/income/2026-09/sources/${id}`, {
    method: "PUT", cookie, params: { month: "2026-09", id }, body: { amountCents },
  });
  expect(r.status).toBe(200);
}

async function bill(cookie: string, name: string, amountCents: number, category: string) {
  const r = await call(billsRoute.POST, "/api/bills", { method: "POST", cookie, body: { name, amountCents, categoryId: await categoryId(cookie, category) } });
  expect(r.status).toBe(201);
}

async function goalBudget(cookie: string, name: string, amountCents: number) {
  const list = await call(goalsRoute.GET, "/api/goals", { cookie });
  const id = (list.json.goals as { id: string; name: string }[]).find((g) => g.name === name)!.id;
  const r = await call(goalAmountRoute.PUT, `/api/goals/month/2026-09/amounts/${id}`, {
    method: "PUT", cookie, params: { month: "2026-09", id }, body: { amountCents },
  });
  expect(r.status).toBe(200);
}

beforeEach(async () => {
  clock.month = "2026-09";
  await getSql()`truncate "user", households, invites, verification cascade`;
});

describe("plan summary", () => {
  it("is all zeros for a new household", async () => {
    const owner = await setupOwner();
    expect(await getPlanSummary(await ctxFor(owner), "2026-09")).toEqual({
      month: "2026-09",
      currency: "USD",
      editable: true,
      incomeCents: 0,
      incomeProvisional: false,
      budgetedCents: 0,
      billsCents: 0,
    });
  });

  it("combines income, budgeted and bills, and agrees with the budget API", async () => {
    const owner = await setupOwner();
    await income(owner, 400000);
    await budget(owner, "Housing", 260000);
    await budget(owner, "Utilities", 10000);
    await bill(owner, "Rent", 250000, "Housing");
    await bill(owner, "Phone", 8000, "Utilities");

    const summary = await getPlanSummary(await ctxFor(owner), "2026-09");
    expect(summary).toMatchObject({ incomeCents: 400000, budgetedCents: 270000, billsCents: 258000 });

    const api = await call(budgetRoute.GET, "/api/budgets/2026-09", { cookie: owner, params: { month: "2026-09" } });
    expect(api.json).toMatchObject({
      incomeCents: summary.incomeCents,
      totalCents: summary.budgetedCents,
      billsTotalCents: summary.billsCents,
      unallocatedCents: summary.incomeCents - summary.budgetedCents,
    });
  });

  it("includes goal amounts in budgetedCents, on Bills/Income too, not just the Budget page (spec 014)", async () => {
    const owner = await setupOwner();
    await income(owner, 400000);
    await budget(owner, "Housing", 100000);
    await goalBudget(owner, "Savings", 50000);

    const summary = await getPlanSummary(await ctxFor(owner), "2026-09");
    expect(summary.budgetedCents).toBe(150000); // 100,000 category + 50,000 goal
    expect(summary.incomeCents - summary.budgetedCents).toBe(250000); // Unallocated

    // Agrees with the Budget API's own combined figure.
    const api = await call(budgetRoute.GET, "/api/budgets/2026-09", { cookie: owner, params: { month: "2026-09" } });
    expect(api.json.unallocatedCents).toBe(summary.incomeCents - summary.budgetedCents);
  });

  it("goes negative (over-allocated) when budgeted exceeds income", async () => {
    const owner = await setupOwner();
    await income(owner, 100000);
    await budget(owner, "Housing", 150000);
    const s = await getPlanSummary(await ctxFor(owner), "2026-09");
    expect(s.incomeCents - s.budgetedCents).toBe(-50000);
  });

  it("marks past months as not editable", async () => {
    const owner = await setupOwner();
    await income(owner, 400000);
    clock.month = "2026-10";
    const past = await getPlanSummary(await ctxFor(owner), "2026-09");
    expect(past.editable).toBe(false);
    expect(past.incomeCents).toBe(400000);
    expect((await getPlanSummary(await ctxFor(owner), "2026-10")).editable).toBe(true);
  });
});
