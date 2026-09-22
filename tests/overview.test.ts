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
import * as categoriesRoute from "@/app/api/categories/route";
import * as depositsRoute from "@/app/api/income/sources/[id]/deposits/route";
import * as incomeAmountRoute from "@/app/api/income/[month]/sources/[id]/route";
import * as incomeSourceRoute from "@/app/api/income/sources/[id]/route";
import * as incomeSourcesRoute from "@/app/api/income/sources/route";
import * as overviewRoute from "@/app/api/overview/[month]/route";
import * as memberRoute from "@/app/api/members/[userId]/route";
import { getDb, getSql } from "@/db";
import { insertUserWithPassword, signInResponse } from "@/lib/accounts";
import type { AttentionItem, Overview } from "@/lib/overview";
import { call, cookieOf, joinAsMember, setupOwner } from "./helpers";

async function overview(cookie: string, m = "2026-09") {
  const r = await call(overviewRoute.GET, `/api/overview/${m}`, { cookie, params: { month: m } });
  return { ...r, data: r.json as unknown as Overview };
}

const codes = (items: AttentionItem[]) => items.map((i) => i.code);

async function categoryId(cookie: string, name: string) {
  const r = await call(budgetRoute.GET, "/api/budgets/2026-09", { cookie, params: { month: "2026-09" } });
  return (r.json.categories as { id: string; name: string }[]).find((c) => c.name === name)!.id;
}

async function addCategory(cookie: string, name: string, type: string) {
  const r = await call(categoriesRoute.POST, "/api/categories", {
    method: "POST", cookie, body: { name, type },
  });
  expect(r.status).toBe(201);
}

async function budget(cookie: string, name: string, amountCents: number) {
  const id = await categoryId(cookie, name);
  const r = await call(allocationRoute.PUT, `/api/budgets/2026-09/allocations/${id}`, {
    method: "PUT", cookie, params: { month: "2026-09", categoryId: id }, body: { amountCents },
  });
  expect(r.status).toBe(200);
}

async function salary(cookie: string, amountCents: number, name = "Salary") {
  const created = await call(incomeSourcesRoute.POST, "/api/income/sources", { method: "POST", cookie, body: { name, kind: "fixed" } });
  const id = (created.json.source as { id: string }).id;
  const r = await call(incomeAmountRoute.PUT, `/api/income/2026-09/sources/${id}`, {
    method: "PUT", cookie, params: { month: "2026-09", id }, body: { amountCents },
  });
  expect(r.status).toBe(200);
}

async function freelance(cookie: string, amountCents: number) {
  const created = await call(incomeSourcesRoute.POST, "/api/income/sources", { method: "POST", cookie, body: { name: "Freelance", kind: "variable" } });
  const id = (created.json.source as { id: string }).id;
  const r = await call(depositsRoute.POST, `/api/income/sources/${id}/deposits`, {
    method: "POST", cookie, params: { id }, body: { receivedOn: "2026-09-05", amountCents },
  });
  expect(r.status).toBe(201);
}

async function bill(cookie: string, name: string, amountCents: number, category: string, extra: Record<string, unknown> = {}) {
  const r = await call(billsRoute.POST, "/api/bills", {
    method: "POST", cookie, body: { name, amountCents, categoryId: await categoryId(cookie, category), ...extra },
  });
  expect(r.status).toBe(201);
}

// Income 4,000 (salary 3,000 + freelance 1,000); budgeted 2,600; Utilities'
// bills (130) are over its budget (100).
async function scenario(owner: string, member: string) {
  await salary(owner, 300000);
  await freelance(member, 100000);
  await budget(owner, "Housing", 200000);
  await budget(owner, "Utilities", 10000);
  await budget(owner, "Groceries", 50000);
  await bill(owner, "Rent", 150000, "Housing");
  await bill(owner, "Phone", 12000, "Utilities");
  await bill(owner, "Domain", 12000, "Utilities", { intervalMonths: 12 }); // 10.00 a month
}

beforeEach(async () => {
  clock.month = "2026-09";
  await getSql()`truncate "user", households, invites, verification cascade`;
});

describe("overview numbers", () => {
  it("composes income, bills, budget and the cash-flow split", async () => {
    const owner = await setupOwner();
    const member = await joinAsMember(owner);
    await scenario(owner, member.cookie);

    const { data } = await overview(owner);
    expect(data).toMatchObject({ month: "2026-09", currency: "USD", editable: true, householdName: "The Smiths" });
    expect(data.income).toMatchObject({ totalCents: 400000, fixedCents: 300000, variableCents: 100000 });
    expect(data.bills.totalCents).toBe(163000); // 1,500 + 120 + 10
    expect(data.budget).toEqual({ budgetedCents: 260000, unallocatedCents: 140000 });

    expect(data.cashFlow).toEqual({
      incomeCents: 400000,
      billsWithinBudgetCents: 160000, // Rent 1,500 + Utilities capped at its 100 budget
      restOfBudgetCents: 100000, // Housing 500 + Groceries 500
      unallocatedCents: 140000,
      overAllocatedCents: 0,
      leftAfterBillsCents: 237000, // 4,000 - 1,630
      savingCents: 0, // "Savings" exists (a starter category) but nothing is budgeted into it
      debtPayoffCents: 0, // no debt payoff category in this scenario
    });
  });

  it("sums budgeted amounts by type into savingCents and debtPayoffCents (spec 013)", async () => {
    const owner = await setupOwner();
    const member = await joinAsMember(owner);
    await scenario(owner, member.cookie);
    await addCategory(owner, "Roth IRA", "saving");
    await addCategory(owner, "Credit card", "debt payoff");
    await budget(owner, "Savings", 30000); // the starter category, type saving
    await budget(owner, "Roth IRA", 20000);
    await budget(owner, "Credit card", 15000);

    const { data } = await overview(owner);
    expect(data.cashFlow.savingCents).toBe(50000); // Savings 300 + Roth IRA 200
    expect(data.cashFlow.debtPayoffCents).toBe(15000);
    // Still counted within the existing totals, not extra money.
    expect(data.cashFlow.billsWithinBudgetCents + data.cashFlow.restOfBudgetCents).toBe(
      data.budget.budgetedCents,
    );
  });

  it("always splits the budget exactly, and income exactly when not over-allocated", async () => {
    const owner = await setupOwner();
    const member = await joinAsMember(owner);
    await scenario(owner, member.cookie);
    const { cashFlow: c, budget: b, income } = (await overview(owner)).data;
    expect(c.billsWithinBudgetCents + c.restOfBudgetCents).toBe(b.budgetedCents);
    expect(c.billsWithinBudgetCents + c.restOfBudgetCents + c.unallocatedCents).toBe(income.totalCents);
  });

  it("uses the same Unallocated as the budget API and the category rows match it", async () => {
    const owner = await setupOwner();
    const member = await joinAsMember(owner);
    await scenario(owner, member.cookie);
    const { data } = await overview(owner);
    const api = await call(budgetRoute.GET, "/api/budgets/2026-09", { cookie: owner, params: { month: "2026-09" } });
    expect(data.budget.unallocatedCents).toBe(api.json.unallocatedCents);
    expect(data.income.totalCents).toBe(api.json.incomeCents);
    expect(data.bills.totalCents).toBe(api.json.billsTotalCents);
    const apiRows = (api.json.categories as { id: string; name: string; type: string; amountCents: number; billsCents: number; remainingCents: number }[]).map((c) => ({
      id: c.id, name: c.name, type: c.type, budgetedCents: c.amountCents, billsCents: c.billsCents, leftCents: c.remainingCents,
    }));
    expect(data.categories).toEqual(apiRows);
  });

  it("breaks income down by member, with a Former member once someone leaves", async () => {
    const owner = await setupOwner();
    const member = await joinAsMember(owner);
    await scenario(owner, member.cookie);
    expect((await overview(owner)).data.income.byMember).toEqual([
      { memberId: expect.any(String), name: "Olive Owner", totalCents: 300000 },
      { memberId: expect.any(String), name: "Mia Member", totalCents: 100000 },
    ]);

    await call(memberRoute.DELETE, `/api/members/${member.userId}`, { method: "DELETE", cookie: owner, params: { userId: member.userId } });
    const after = (await overview(owner)).data.income;
    expect(after.totalCents).toBe(400000);
    expect(after.byMember.find((m) => m.memberId === null)).toEqual({ memberId: null, name: "Former member", totalCents: 100000 });
  });

  it("lists bills by category and the largest first, with yearly bills as monthly amounts", async () => {
    const owner = await setupOwner();
    const member = await joinAsMember(owner);
    await scenario(owner, member.cookie);
    const { bills } = (await overview(owner)).data;
    expect(bills.byCategory.map((c) => [c.name, c.totalCents])).toEqual([["Housing", 150000], ["Utilities", 13000]]);
    expect(bills.largest.map((b) => [b.name, b.monthlyCents])).toEqual([["Rent", 150000], ["Phone", 12000], ["Domain", 1000]]);
    expect(bills.largest.find((b) => b.name === "Domain")).toMatchObject({ amountCents: 12000, intervalMonths: 12 });
  });

  it("caps the largest-bills list at five", async () => {
    const owner = await setupOwner();
    for (let i = 1; i <= 7; i++) await bill(owner, `Bill ${i}`, i * 1000, "Other");
    const { largest } = (await overview(owner)).data.bills;
    expect(largest).toHaveLength(5);
    expect(largest[0].name).toBe("Bill 7");
  });
});

describe("attention items", () => {
  it("flags a category whose bills exceed its budget and unallocated money, with links", async () => {
    const owner = await setupOwner();
    const member = await joinAsMember(owner);
    await scenario(owner, member.cookie);
    const { attention } = (await overview(owner)).data;
    expect(codes(attention)).toEqual(["category_bills_over_budget", "unallocated"]);

    const over = attention[0];
    expect(over).toMatchObject({ severity: "warning", amountCents: 3000, href: "/budget", actionLabel: "Adjust budget" });
    expect(over.message).toBe("Utilities: bills are $30.00 over its budget.");
    expect(over.categoryId).toBe(await categoryId(owner, "Utilities"));

    expect(attention[1]).toMatchObject({ severity: "info", amountCents: 140000, href: "/budget#assign", actionLabel: "Assign" });
    expect(attention[1].message).toBe("$1,400.00 is not assigned to a category yet.");
  });

  it("flags over-allocation instead of unallocated money", async () => {
    const owner = await setupOwner();
    await salary(owner, 100000);
    await budget(owner, "Housing", 150000);
    const { attention } = (await overview(owner)).data;
    // No bills in this scenario, so the setup prompt is also right.
    expect(codes(attention)).toEqual(["over_allocated", "no_bills"]);
    expect(attention[0]).toMatchObject({ amountCents: 50000, href: "/budget" });
    expect(attention[0].message).toBe("You have budgeted $500.00 more than your income.");
  });

  it("flags bills that exceed income", async () => {
    const owner = await setupOwner();
    await salary(owner, 100000);
    await budget(owner, "Housing", 200000);
    await bill(owner, "Rent", 150000, "Housing");
    const { attention } = (await overview(owner)).data;
    expect(codes(attention)).toEqual(["over_allocated", "bills_exceed_income"]);
    expect(attention[1]).toMatchObject({ amountCents: 50000, href: "/bills" });
  });

  it("shows only setup prompts for a household with nothing in it", async () => {
    const owner = await setupOwner();
    const { data } = await overview(owner);
    expect(codes(data.attention)).toEqual(["no_income", "no_bills"]);
    expect(data.attention.map((i) => i.href)).toEqual(["/income", "/bills"]);
    expect(data.cashFlow).toEqual({
      incomeCents: 0, billsWithinBudgetCents: 0, restOfBudgetCents: 0,
      unallocatedCents: 0, overAllocatedCents: 0, leftAfterBillsCents: 0,
      savingCents: 0, debtPayoffCents: 0,
    });
    expect(data.income.byMember.map((m) => m.name)).toEqual(["Olive Owner"]);
  });

  it("stops prompting once income and a bill exist, and shows nothing when all is in order", async () => {
    const owner = await setupOwner();
    await salary(owner, 100000);
    await budget(owner, "Housing", 100000);
    await bill(owner, "Rent", 50000, "Housing");
    expect((await overview(owner)).data.attention).toEqual([]);
  });

  it("puts the selected month in the links when it is not the current one", async () => {
    const owner = await setupOwner();
    await salary(owner, 400000);
    const next = await overview(owner, "2026-10"); // income carries forward, nothing budgeted yet
    const unallocated = next.data.attention.find((i) => i.code === "unallocated")!;
    expect(unallocated.href).toBe("/budget?month=2026-10#assign");
  });

  it("offers no Assign or setup prompts for a past month", async () => {
    const owner = await setupOwner();
    const member = await joinAsMember(owner);
    await scenario(owner, member.cookie);
    clock.month = "2026-10";
    const past = (await overview(owner, "2026-09")).data;
    expect(past.editable).toBe(false);
    expect(codes(past.attention)).toEqual(["category_bills_over_budget"]); // history is still reported
    expect(past.attention.some((i) => i.code === "unallocated" || i.code === "no_income" || i.code === "no_bills")).toBe(false);

    clock.month = "2026-10";
    const empty = (await overview(owner, "2026-08")).data; // before the household existed
    expect(empty.editable).toBe(false);
    expect(empty.attention).toEqual([]);
    expect(empty.categories).toEqual([]);
  });

  it("reports the month's amounts in the household's currency", async () => {
    const r = await call((await import("@/app/api/setup/route")).POST, "/api/setup", {
      method: "POST",
      body: { householdName: "Euro House", name: "Olive Owner", email: "o@example.com", password: "correct horse battery", currency: "EUR" },
    });
    const owner = cookieOf(r.res);
    await salary(owner, 100000);
    await budget(owner, "Housing", 20000);
    const { data } = await overview(owner);
    expect(data.currency).toBe("EUR");
    expect(data.attention.find((i) => i.code === "unallocated")!.message).toBe("€800.00 is not assigned to a category yet.");
  });
});

describe("provisional income (spec 010)", () => {
  async function variableSource(cookie: string, name = "Freelance") {
    const r = await call(incomeSourcesRoute.POST, "/api/income/sources", { method: "POST", cookie, body: { name, kind: "variable" } });
    return (r.json.source as { id: string }).id;
  }
  const budgetApi = (cookie: string, m = "2026-09") =>
    call(budgetRoute.GET, `/api/budgets/${m}`, { cookie, params: { month: m } });

  it("is false for a household with only fixed income, in every month", async () => {
    const owner = await setupOwner();
    await salary(owner, 100000);
    for (const m of ["2026-09", "2026-10", "2026-11"]) {
      expect((await overview(owner, m)).data.incomeProvisional).toBe(false);
      expect((await budgetApi(owner, m)).json.incomeProvisional).toBe(false);
    }
  });

  it("is true for the current and later months once a variable source is active, false for past months", async () => {
    const owner = await setupOwner();
    await salary(owner, 100000);
    await variableSource(owner); // no deposits at all yet
    expect((await overview(owner, "2026-09")).data.incomeProvisional).toBe(true);
    expect((await overview(owner, "2026-10")).data.incomeProvisional).toBe(true);
    expect((await budgetApi(owner, "2026-11")).json.incomeProvisional).toBe(true);

    clock.month = "2026-10";
    expect((await overview(owner, "2026-09")).data.incomeProvisional).toBe(false); // now a past month: final
    expect((await overview(owner, "2026-10")).data.incomeProvisional).toBe(true);
  });

  it("stops being provisional when the variable source is archived", async () => {
    const owner = await setupOwner();
    await salary(owner, 100000);
    const id = await variableSource(owner);
    expect((await overview(owner)).data.incomeProvisional).toBe(true);
    const archived = await call(incomeSourceRoute.PATCH, `/api/income/sources/${id}`, { method: "PATCH", cookie: owner, params: { id }, body: { archived: true } });
    expect(archived.status).toBe(204);
    expect((await overview(owner)).data.incomeProvisional).toBe(false);
  });

  it("softens over-allocation and bills-over-income to info, with wording about recorded income", async () => {
    const owner = await setupOwner();
    await salary(owner, 100000);
    await variableSource(owner);
    await budget(owner, "Housing", 200000);
    await bill(owner, "Rent", 150000, "Housing");
    const { attention } = (await overview(owner)).data;
    expect(codes(attention)).toEqual(["over_allocated", "bills_exceed_income"]);
    expect(attention.map((i) => i.severity)).toEqual(["info", "info"]);
    expect(attention[0].message).toBe("You have budgeted $1,000.00 more than the income recorded so far. Variable income counts once you record it.");
    expect(attention[1].message).toBe("Bills ($1,500.00) are more than the income recorded so far ($1,000.00). Variable income counts once you record it.");
    expect(attention[0]).toMatchObject({ href: "/budget", amountCents: 100000 });
  });

  it("keeps them as warnings with the original wording when the income is final", async () => {
    const owner = await setupOwner();
    await salary(owner, 100000);
    await budget(owner, "Housing", 200000);
    await bill(owner, "Rent", 150000, "Housing");
    const { attention } = (await overview(owner)).data;
    expect(attention.map((i) => [i.code, i.severity])).toEqual([
      ["over_allocated", "warning"],
      ["bills_exceed_income", "warning"],
    ]);
    expect(attention[0].message).toBe("You have budgeted $1,000.00 more than your income.");
  });

  it("never softens a category whose bills exceed its own budget", async () => {
    const owner = await setupOwner();
    await salary(owner, 400000);
    await variableSource(owner);
    await budget(owner, "Utilities", 10000);
    await bill(owner, "Phone", 15000, "Utilities");
    const over = (await overview(owner)).data.attention.find((i) => i.code === "category_bills_over_budget")!;
    expect(over.severity).toBe("warning");
  });

  it("changes no amounts", async () => {
    const owner = await setupOwner();
    const member = await joinAsMember(owner);
    await scenario(owner, member.cookie); // includes a variable source with a deposit
    const { data } = await overview(owner);
    expect(data.incomeProvisional).toBe(true);
    expect(data.income.totalCents).toBe(400000);
    expect(data.budget).toEqual({ budgetedCents: 260000, unallocatedCents: 140000 });
    expect(data.cashFlow.unallocatedCents).toBe(140000);
    const api = await budgetApi(owner);
    expect(api.json.unallocatedCents).toBe(140000);
    expect(api.json.incomeCents).toBe(400000);
  });

  it("softens next month's shortfall when only a one-off deposit made this month whole", async () => {
    const owner = await setupOwner();
    const member = await joinAsMember(owner);
    await salary(owner, 300000);
    await freelance(member.cookie, 100000); // September only
    await budget(owner, "Housing", 350000); // more than the 3,000 fixed salary
    const next = (await overview(owner, "2026-10")).data;
    expect(next.income.totalCents).toBe(300000); // the deposit does not repeat
    expect(next.incomeProvisional).toBe(true);
    const over = next.attention.find((i) => i.code === "over_allocated")!;
    expect(over.severity).toBe("info");
    expect(over.href).toBe("/budget?month=2026-10");
    expect(over.message).toContain("recorded so far");
  });
});

describe("access control", () => {
  it("rejects signed-out users and non-members", async () => {
    await setupOwner();
    expect((await call(overviewRoute.GET, "/api/overview/2026-09", { params: { month: "2026-09" } })).status).toBe(401);

    await getDb().transaction((tx) =>
      insertUserWithPassword(tx, { name: "Stranger", email: "stranger@example.com", password: "stranger password" }),
    );
    const cookie = cookieOf(await signInResponse("stranger@example.com", "stranger password", new Headers()));
    expect((await overview(cookie)).status).toBe(403);
  });

  it("lets any household member read it, and validates the month", async () => {
    const owner = await setupOwner();
    const member = await joinAsMember(owner);
    expect((await overview(member.cookie)).status).toBe(200);
    for (const bad of ["2026-13", "abcd", "2026-9", "1999-01"]) {
      expect((await overview(owner, bad)).status).toBe(400);
    }
  });
});
