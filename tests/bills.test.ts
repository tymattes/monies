import { beforeEach, describe, expect, it, vi } from "vitest";

// Control "today" so tests can move between months.
const clock = vi.hoisted(() => ({ month: "2026-09" }));
vi.mock("@/lib/months", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/months")>()),
  currentMonth: () => clock.month,
}));

import * as allocationRoute from "@/app/api/budgets/[month]/allocations/[categoryId]/route";
import * as budgetRoute from "@/app/api/budgets/[month]/route";
import * as monthRoute from "@/app/api/bills/[month]/route";
import * as versionRoute from "@/app/api/bills/[month]/items/[id]/route";
import * as itemRoute from "@/app/api/bills/items/[id]/route";
import * as billsRoute from "@/app/api/bills/route";
import * as categoryRoute from "@/app/api/categories/[id]/route";
import * as incomeAmountRoute from "@/app/api/income/[month]/sources/[id]/route";
import * as incomeSourcesRoute from "@/app/api/income/sources/route";
import * as memberRoute from "@/app/api/members/[userId]/route";
import * as householdRoute from "@/app/api/household/route";
import { getDb, getSql } from "@/db";
import { insertUserWithPassword, signInResponse } from "@/lib/accounts";
import { monthlyEquivalent } from "@/lib/bills";
import { call, cookieOf, joinAsMember, setupOwner } from "./helpers";

type Bill = {
  id: string;
  name: string;
  amountCents: number;
  intervalMonths: number;
  monthlyCents: number;
  categoryId: string;
  categoryName: string;
  paidById: string | null;
  paidBy: string | null;
  note: string | null;
  addedBy: string;
  addedById: string | null;
};

async function month(cookie: string, m = "2026-09") {
  const r = await call(monthRoute.GET, `/api/bills/${m}`, { cookie, params: { month: m } });
  return { ...r, bills: (r.json.bills ?? []) as Bill[] };
}

async function budget(cookie: string, m = "2026-09") {
  const r = await call(budgetRoute.GET, `/api/budgets/${m}`, { cookie, params: { month: m } });
  return {
    ...r,
    lines: (r.json.categories ?? []) as { id: string; name: string; amountCents: number; billsCents: number; remainingCents: number }[],
  };
}

const categoryId = async (cookie: string, name: string, m = "2026-09") =>
  (await budget(cookie, m)).lines.find((l) => l.name === name)!.id;

async function meId(cookie: string) {
  const r = await call(householdRoute.GET, "/api/household", { cookie });
  return (r.json.me as { id: string }).id;
}

async function addBill(cookie: string, body: Record<string, unknown>) {
  return call(billsRoute.POST, "/api/bills", { method: "POST", cookie, body });
}

async function makeBill(cookie: string, name: string, amountCents: number, cat: string, extra: Record<string, unknown> = {}) {
  const r = await addBill(cookie, { name, amountCents, categoryId: await categoryId(cookie, cat), ...extra });
  expect(r.status).toBe(201);
  return (r.json.bill as { id: string }).id;
}

async function setVersion(cookie: string, m: string, id: string, body: Record<string, unknown>) {
  return call(versionRoute.PUT, `/api/bills/${m}/items/${id}`, {
    method: "PUT",
    cookie,
    params: { month: m, id },
    body,
  });
}

async function patchBill(cookie: string, id: string, body: unknown) {
  return call(itemRoute.PATCH, `/api/bills/items/${id}`, {
    method: "PATCH",
    cookie,
    params: { id },
    body,
  });
}

async function patchCategory(cookie: string, id: string, body: unknown) {
  return call(categoryRoute.PATCH, `/api/categories/${id}`, {
    method: "PATCH",
    cookie,
    params: { id },
    body,
  });
}

const monthlyOf = async (cookie: string, name: string, m = "2026-09") =>
  (await month(cookie, m)).bills.find((b) => b.name === name)?.monthlyCents;

beforeEach(async () => {
  clock.month = "2026-09";
  await getSql()`truncate "user", households, invites, verification cascade`;
});

describe("monthly equivalent", () => {
  it("divides by the billing period, rounding half up", () => {
    expect(monthlyEquivalent(12000, 12)).toBe(1000);
    expect(monthlyEquivalent(6000, 6)).toBe(1000);
    expect(monthlyEquivalent(3000, 3)).toBe(1000);
    expect(monthlyEquivalent(1234, 1)).toBe(1234);
    expect(monthlyEquivalent(1999, 12)).toBe(167); // 166.58
    expect(monthlyEquivalent(100, 6)).toBe(17); // 16.67
    expect(monthlyEquivalent(100, 3)).toBe(33); // 33.33
    expect(monthlyEquivalent(3, 6)).toBe(1); // exactly 0.5 rounds up
    expect(monthlyEquivalent(0, 12)).toBe(0);
  });

  it("matches the database's rollup for uneven amounts", async () => {
    const owner = await setupOwner();
    const cases: [string, number, number][] = [
      ["Domain", 1999, 12],
      ["Insurance", 100, 6],
      ["Warranty", 100, 3],
      ["Half", 3, 6],
      ["Zero", 0, 12],
    ];
    for (const [name, amount, interval] of cases) {
      await makeBill(owner, name, amount, "Other", { intervalMonths: interval });
      expect(await monthlyOf(owner, name)).toBe(monthlyEquivalent(amount, interval));
    }
  });
});

describe("adding a bill", () => {
  it("requires a category the user chooses", async () => {
    const owner = await setupOwner();
    const base = { name: "Netflix", amountCents: 1599 };
    expect((await addBill(owner, base)).status).toBe(400);
    expect((await addBill(owner, { ...base, categoryId: "" })).status).toBe(400);
    expect((await addBill(owner, { ...base, categoryId: 5 })).status).toBe(400);
    expect((await addBill(owner, { ...base, categoryId: "not-a-uuid" })).status).toBe(400);
    expect((await addBill(owner, { ...base, categoryId: "00000000-0000-0000-0000-000000000000" })).status).toBe(400);
    expect((await month(owner)).bills).toHaveLength(0);
  });

  it("rejects an archived category", async () => {
    const owner = await setupOwner();
    const other = await categoryId(owner, "Other");
    await patchCategory(owner, other, { archived: true });
    expect((await addBill(owner, { name: "x", amountCents: 100, categoryId: other })).status).toBe(400);
  });

  it("creates a bill with the adder's name and its details", async () => {
    const owner = await setupOwner();
    const ownerId = await meId(owner);
    const r = await addBill(owner, {
      name: "Netflix",
      amountCents: 1599,
      categoryId: await categoryId(owner, "Entertainment"),
      paidBy: ownerId,
      note: "Family plan",
    });
    expect(r.status).toBe(201);
    expect(r.json.bill).toMatchObject({ amountCents: 1599, intervalMonths: 1, monthlyCents: 1599 });
    const [bill] = (await month(owner)).bills;
    expect(bill).toMatchObject({
      name: "Netflix",
      categoryName: "Entertainment",
      paidById: ownerId,
      paidBy: "Olive Owner",
      note: "Family plan",
      addedBy: "Olive Owner",
    });
  });

  it.each([
    ["negative", { amountCents: -1 }],
    ["fractional", { amountCents: 10.5 }],
    ["a string", { amountCents: "100" }],
    ["too large", { amountCents: 2_000_000_001 }],
    ["missing", { amountCents: undefined }],
    ["an unsupported period", { intervalMonths: 2 }],
    ["a string period", { intervalMonths: "12" }],
    ["a zero period", { intervalMonths: 0 }],
    ["an empty name", { name: "  " }],
    ["a long note", { note: "x".repeat(201) }],
    ["a malformed paidBy", { paidBy: "not-a-uuid" }],
    ["a non-member paidBy", { paidBy: "00000000-0000-0000-0000-000000000000" }],
  ])("rejects %s", async (_label, overrides) => {
    const owner = await setupOwner();
    const r = await addBill(owner, {
      name: "Bill",
      amountCents: 1000,
      categoryId: await categoryId(owner, "Other"),
      ...overrides,
    });
    expect(r.status).toBe(400);
    expect((await month(owner)).bills).toHaveLength(0);
  });

  it("allows a zero amount as a placeholder", async () => {
    const owner = await setupOwner();
    await makeBill(owner, "Paused gym", 0, "Health");
    expect(await monthlyOf(owner, "Paused gym")).toBe(0);
  });
});

describe("how a bill counts over time", () => {
  it("counts from its start month onward and never before", async () => {
    const owner = await setupOwner();
    await makeBill(owner, "Rent", 250000, "Housing");
    expect(await monthlyOf(owner, "Rent", "2026-08")).toBeUndefined();
    expect(await monthlyOf(owner, "Rent", "2026-09")).toBe(250000);
    expect(await monthlyOf(owner, "Rent", "2026-10")).toBe(250000);
    expect(await monthlyOf(owner, "Rent", "2027-06")).toBe(250000);
  });

  it("spreads yearly, 6-month and 3-month bills evenly over every month", async () => {
    const owner = await setupOwner();
    await makeBill(owner, "Domain", 12000, "Other", { intervalMonths: 12 });
    await makeBill(owner, "Insurance", 60000, "Transport", { intervalMonths: 6 });
    await makeBill(owner, "Pest control", 9000, "Utilities", { intervalMonths: 3 });
    for (const m of ["2026-09", "2026-10", "2026-11", "2027-03", "2027-09"]) {
      expect(await monthlyOf(owner, "Domain", m)).toBe(1000);
      expect(await monthlyOf(owner, "Insurance", m)).toBe(10000);
      expect(await monthlyOf(owner, "Pest control", m)).toBe(3000);
    }
    const view = await month(owner);
    expect(view.bills.find((b) => b.name === "Domain")).toMatchObject({ amountCents: 12000, intervalMonths: 12, monthlyCents: 1000 });
    expect(view.json.totalCents).toBe(14000);
  });

  it("applies a new amount, period and category from the chosen month only", async () => {
    const owner = await setupOwner();
    const id = await makeBill(owner, "Streaming", 1500, "Entertainment");
    const dining = await categoryId(owner, "Dining out");
    expect((await setVersion(owner, "2026-11", id, { amountCents: 12000, intervalMonths: 12, categoryId: dining })).status).toBe(200);

    expect(await monthlyOf(owner, "Streaming", "2026-09")).toBe(1500);
    expect(await monthlyOf(owner, "Streaming", "2026-10")).toBe(1500);
    expect(await monthlyOf(owner, "Streaming", "2026-11")).toBe(1000);
    expect(await monthlyOf(owner, "Streaming", "2027-01")).toBe(1000);
    const sept = (await month(owner, "2026-09")).bills[0];
    const nov = (await month(owner, "2026-11")).bills[0];
    expect([sept.categoryName, sept.intervalMonths]).toEqual(["Entertainment", 1]);
    expect([nov.categoryName, nov.intervalMonths]).toEqual(["Dining out", 12]);
  });

  it("keeps past months accurate and read-only once time moves on", async () => {
    const owner = await setupOwner();
    const id = await makeBill(owner, "Phone", 8000, "Utilities");
    const utilities = await categoryId(owner, "Utilities");

    clock.month = "2026-10";
    const before = await month(owner, "2026-09");
    expect(before.json.editable).toBe(false);
    expect((await setVersion(owner, "2026-10", id, { amountCents: 9000, intervalMonths: 1, categoryId: utilities })).status).toBe(200);
    expect((await month(owner, "2026-09")).bills).toEqual(before.bills);

    const rewrite = await setVersion(owner, "2026-09", id, { amountCents: 1, intervalMonths: 1, categoryId: utilities });
    expect(rewrite.status).toBe(400);
    expect(rewrite.json.error).toMatch(/read-only/);
  });

  it("rejects incomplete or invalid versions", async () => {
    const owner = await setupOwner();
    const id = await makeBill(owner, "Phone", 8000, "Utilities");
    const utilities = await categoryId(owner, "Utilities");
    const ok = { amountCents: 100, intervalMonths: 1, categoryId: utilities };
    for (const bad of [
      { ...ok, amountCents: -1 },
      { ...ok, amountCents: 1.5 },
      { ...ok, intervalMonths: 5 },
      { ...ok, intervalMonths: undefined },
      { ...ok, categoryId: undefined },
      { ...ok, categoryId: "00000000-0000-0000-0000-000000000000" },
    ]) {
      expect((await setVersion(owner, "2026-10", id, bad)).status).toBe(400);
    }
    expect((await setVersion(owner, "2026-13", id, ok)).status).toBe(400);
    const missing = "00000000-0000-0000-0000-000000000000";
    expect((await setVersion(owner, "2026-10", missing, ok)).status).toBe(404);
    // Not active yet in an earlier month than it started.
    expect((await monthlyOf(owner, "Phone", "2026-09"))).toBe(8000);
    expect(await monthlyOf(owner, "Phone", "2026-10")).toBe(8000);
  });

  it("ends a bill from this month onward while past months keep it", async () => {
    const owner = await setupOwner();
    const id = await makeBill(owner, "Old gym", 4000, "Health");
    clock.month = "2026-10";
    expect((await patchBill(owner, id, { archived: true })).status).toBe(204);
    expect(await monthlyOf(owner, "Old gym", "2026-09")).toBe(4000);
    expect(await monthlyOf(owner, "Old gym", "2026-10")).toBeUndefined();
    expect(await monthlyOf(owner, "Old gym", "2026-12")).toBeUndefined();
    expect((await setVersion(owner, "2026-10", id, { amountCents: 1, intervalMonths: 1, categoryId: await categoryId(owner, "Health", "2026-10") })).status).toBe(404);

    await patchBill(owner, id, { archived: false });
    expect(await monthlyOf(owner, "Old gym", "2026-10")).toBe(4000);
  });

  it("renames and edits labels without touching amounts", async () => {
    const owner = await setupOwner();
    const ownerId = await meId(owner);
    const id = await makeBill(owner, "Phone", 8000, "Utilities", { paidBy: ownerId, note: "old" });
    expect((await patchBill(owner, id, { name: "Cell plan", paidBy: null, note: "Two lines" })).status).toBe(204);
    const [bill] = (await month(owner)).bills;
    expect(bill).toMatchObject({ name: "Cell plan", paidById: null, paidBy: null, note: "Two lines", monthlyCents: 8000 });
    expect((await patchBill(owner, id, {})).status).toBe(400);
    expect((await patchBill(owner, id, { archived: "yes" })).status).toBe(400);
    expect((await patchBill(owner, id, { name: " " })).status).toBe(400);
  });

  it("rejects a non-member or malformed paidBy on edit", async () => {
    const owner = await setupOwner();
    const id = await makeBill(owner, "Phone", 8000, "Utilities");
    expect((await patchBill(owner, id, { paidBy: "not-a-uuid" })).status).toBe(400);
    expect((await patchBill(owner, id, { paidBy: "00000000-0000-0000-0000-000000000000" })).status).toBe(400);
  });
});

describe("who added it", () => {
  it("tags each bill with its adder, and any member can edit any bill", async () => {
    const owner = await setupOwner();
    const member = await joinAsMember(owner);
    const ownerBill = await makeBill(owner, "Rent", 250000, "Housing");
    const memberBill = await makeBill(member.cookie, "Phone", 8000, "Utilities");

    const view = await month(member.cookie);
    expect(view.bills.find((b) => b.name === "Rent")?.addedBy).toBe("Olive Owner");
    expect(view.bills.find((b) => b.name === "Phone")?.addedBy).toBe("Mia Member");

    const housing = await categoryId(owner, "Housing");
    expect((await setVersion(member.cookie, "2026-10", ownerBill, { amountCents: 260000, intervalMonths: 1, categoryId: housing })).status).toBe(200);
    expect((await patchBill(member.cookie, ownerBill, { name: "Rent + parking" })).status).toBe(204);
    expect((await patchBill(owner, memberBill, { archived: true })).status).toBe(204);
  });

  it("keeps a removed member's bills, shown as 'Former member'", async () => {
    const owner = await setupOwner();
    const leaver = await joinAsMember(owner);
    await makeBill(leaver.cookie, "Phone", 8000, "Utilities");
    const removed = await call(memberRoute.DELETE, `/api/members/${leaver.userId}`, {
      method: "DELETE",
      cookie: owner,
      params: { userId: leaver.userId },
    });
    expect(removed.status).toBe(204);
    const view = await month(owner);
    expect(view.bills[0]).toMatchObject({ name: "Phone", addedBy: "Former member", addedById: null });
    expect(view.json.totalCents).toBe(8000);
  });

  it("a removed payer's bill shows no payer, not 'Former member'", async () => {
    const owner = await setupOwner();
    const payer = await joinAsMember(owner);
    const id = await makeBill(owner, "Phone", 8000, "Utilities", { paidBy: payer.userId });
    expect((await month(owner)).bills[0]).toMatchObject({ paidById: payer.userId, paidBy: "Mia Member" });

    await call(memberRoute.DELETE, `/api/members/${payer.userId}`, {
      method: "DELETE",
      cookie: owner,
      params: { userId: payer.userId },
    });
    expect((await month(owner)).bills[0]).toMatchObject({ id, paidById: null, paidBy: null });
  });
});

describe("month view", () => {
  it("groups by category with subtotals and a total", async () => {
    const owner = await setupOwner();
    const ownerId = await meId(owner);
    await makeBill(owner, "Rent", 250000, "Housing", { paidBy: ownerId });
    await makeBill(owner, "Phone", 8000, "Utilities");
    await makeBill(owner, "Water", 4000, "Utilities");
    await makeBill(owner, "Domain", 12000, "Utilities", { intervalMonths: 12 });

    const view = await month(owner);
    expect(view.json.categories).toEqual([
      expect.objectContaining({ name: "Housing", totalCents: 250000 }),
      expect.objectContaining({ name: "Utilities", totalCents: 13000 }),
    ]);
    expect(view.json.totalCents).toBe(263000);
    expect(view.json.currency).toBe("USD");
  });
});

describe("category archiving", () => {
  it("is blocked while a category has active bills, and allowed once they are ended or moved", async () => {
    const owner = await setupOwner();
    const utilities = await categoryId(owner, "Utilities");
    const phone = await makeBill(owner, "Phone", 8000, "Utilities");
    const water = await makeBill(owner, "Water", 4000, "Utilities");

    const blocked = await patchCategory(owner, utilities, { archived: true });
    expect(blocked.status).toBe(409);
    expect(blocked.json.error).toMatch(/2 active bills/);

    await patchBill(owner, phone, { archived: true });
    const one = await patchCategory(owner, utilities, { archived: true });
    expect(one.status).toBe(409);
    expect(one.json.error).toMatch(/1 active bill\b/);

    const other = await categoryId(owner, "Other");
    await setVersion(owner, "2026-09", water, { amountCents: 4000, intervalMonths: 1, categoryId: other });
    expect((await patchCategory(owner, utilities, { archived: true })).status).toBe(204);
  });

  it("is also blocked when a scheduled future version moves a bill into the category", async () => {
    const owner = await setupOwner();
    const bill = await makeBill(owner, "Phone", 8000, "Utilities");
    const health = await categoryId(owner, "Health");
    await setVersion(owner, "2026-12", bill, { amountCents: 8000, intervalMonths: 1, categoryId: health });
    expect((await patchCategory(owner, health, { archived: true })).status).toBe(409);
    // The category it is leaving is free once the move is scheduled and this month has passed.
    expect((await patchCategory(owner, await categoryId(owner, "Dining out"), { archived: true })).status).toBe(204);
  });
});

describe("budget integration", () => {
  async function setAllocation(cookie: string, name: string, amountCents: number) {
    const id = await categoryId(cookie, name);
    const r = await call(allocationRoute.PUT, `/api/budgets/2026-09/allocations/${id}`, {
      method: "PUT",
      cookie,
      params: { month: "2026-09", categoryId: id },
      body: { amountCents },
    });
    expect(r.status).toBe(200);
  }

  it("shows bills and remaining per category, plus the summary totals", async () => {
    const owner = await setupOwner();
    const salary = (await call(incomeSourcesRoute.POST, "/api/income/sources", { method: "POST", cookie: owner, body: { name: "Salary", kind: "fixed" } })).json.source as { id: string };
    await call(incomeAmountRoute.PUT, `/api/income/2026-09/sources/${salary.id}`, { method: "PUT", cookie: owner, params: { month: "2026-09", id: salary.id }, body: { amountCents: 400000 } });

    await setAllocation(owner, "Housing", 260000);
    await setAllocation(owner, "Utilities", 10000);
    await makeBill(owner, "Rent", 250000, "Housing");
    await makeBill(owner, "Phone", 8000, "Utilities");
    await makeBill(owner, "Domain", 12000, "Utilities", { intervalMonths: 12 }); // 1000/mo

    const b = await budget(owner);
    const line = (name: string) => b.lines.find((l) => l.name === name)!;
    expect(line("Housing")).toMatchObject({ amountCents: 260000, billsCents: 250000, remainingCents: 10000 });
    expect(line("Utilities")).toMatchObject({ amountCents: 10000, billsCents: 9000, remainingCents: 1000 });
    expect(line("Groceries")).toMatchObject({ amountCents: 0, billsCents: 0, remainingCents: 0 });
    expect(b.json).toMatchObject({
      billsTotalCents: 259000,
      incomeCents: 400000,
      leftAfterBillsCents: 141000,
      totalCents: 270000,
      // Unallocated is income minus bills (spec 022), not minus budgeted:
      // 400000 - 259000 = 141000.
      unallocatedCents: 141000,
    });
  });

  it("flags a category whose bills exceed its budget with a negative remainder", async () => {
    const owner = await setupOwner();
    await setAllocation(owner, "Utilities", 5000);
    await makeBill(owner, "Phone", 8000, "Utilities");
    const utilities = (await budget(owner)).lines.find((l) => l.name === "Utilities")!;
    expect(utilities).toMatchObject({ billsCents: 8000, remainingCents: -3000 });
  });

  it("follows a bill when its category changes for a later month", async () => {
    const owner = await setupOwner();
    const bill = await makeBill(owner, "Phone", 8000, "Utilities");
    await setVersion(owner, "2026-11", bill, { amountCents: 8000, intervalMonths: 1, categoryId: await categoryId(owner, "Other") });
    const nov = (await budget(owner, "2026-11")).lines;
    expect(nov.find((l) => l.name === "Utilities")?.billsCents).toBe(0);
    expect(nov.find((l) => l.name === "Other")?.billsCents).toBe(8000);
    const sept = (await budget(owner, "2026-09")).lines;
    expect(sept.find((l) => l.name === "Utilities")?.billsCents).toBe(8000);
  });
});

describe("access control", () => {
  it("rejects signed-out users on every route", async () => {
    await setupOwner();
    const id = "00000000-0000-0000-0000-000000000000";
    const results = await Promise.all([
      call(billsRoute.POST, "/api/bills", { method: "POST", body: { name: "x", amountCents: 1, categoryId: id } }),
      call(monthRoute.GET, "/api/bills/2026-09", { params: { month: "2026-09" } }),
      call(itemRoute.PATCH, `/api/bills/items/${id}`, { method: "PATCH", params: { id }, body: { name: "x" } }),
      call(versionRoute.PUT, `/api/bills/2026-09/items/${id}`, { method: "PUT", params: { month: "2026-09", id }, body: { amountCents: 1, intervalMonths: 1, categoryId: id } }),
    ]);
    expect(results.map((r) => r.status)).toEqual([401, 401, 401, 401]);
  });

  it("rejects a signed-in user who is not a household member", async () => {
    await setupOwner();
    await getDb().transaction((tx) =>
      insertUserWithPassword(tx, { name: "Stranger", email: "stranger@example.com", password: "stranger password" }),
    );
    const cookie = cookieOf(await signInResponse("stranger@example.com", "stranger password", new Headers()));
    expect((await month(cookie)).status).toBe(403);
    expect((await addBill(cookie, { name: "x", amountCents: 1, categoryId: "00000000-0000-0000-0000-000000000000" })).status).toBe(403);
  });
});
