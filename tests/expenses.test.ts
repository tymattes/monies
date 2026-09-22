import { beforeEach, describe, expect, it, vi } from "vitest";

// Control "today" so tests can move between months and pin "now" for the
// future-date rejection.
const clock = vi.hoisted(() => ({ month: "2026-09", day: 15 }));
vi.mock("@/lib/months", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/months")>()),
  currentMonth: () => clock.month,
  currentDate: () => `${clock.month}-${String(clock.day).padStart(2, "0")}`,
}));

import * as allocationRoute from "@/app/api/budgets/[month]/allocations/[categoryId]/route";
import * as budgetRoute from "@/app/api/budgets/[month]/route";
import * as expenseRoute from "@/app/api/expenses/route";
import * as expenseItemRoute from "@/app/api/expenses/[id]/route";
import * as expensesMonthRoute from "@/app/api/expenses/month/[month]/route";
import { getDb, getSql } from "@/db";
import { insertUserWithPassword, signInResponse } from "@/lib/accounts";
import { call, cookieOf, joinAsMember, setupOwner } from "./helpers";

type BudgetLine = {
  id: string;
  name: string;
  amountCents: number;
  billsCents: number;
  expensesCents: number;
  remainingCents: number;
};

async function budget(cookie: string, month = clock.month) {
  const r = await call(budgetRoute.GET, `/api/budgets/${month}`, {
    cookie,
    params: { month },
  });
  return {
    ...r,
    lines: (r.json.categories ?? []) as BudgetLine[],
    expensesTotalCents: r.json.expensesTotalCents as number,
  };
}

async function idOf(cookie: string, name: string, month = clock.month) {
  const line = (await budget(cookie, month)).lines.find((l) => l.name === name);
  if (!line) throw new Error(`no category ${name} in ${month}`);
  return line.id;
}

async function setAmount(
  cookie: string,
  month: string,
  categoryId: string,
  amountCents: number,
) {
  return call(allocationRoute.PUT, `/api/budgets/${month}/allocations/${categoryId}`, {
    method: "PUT",
    cookie,
    params: { month, categoryId },
    body: { amountCents },
  });
}

async function addExpense(
  cookie: string,
  body: { categoryId?: string; amountCents?: unknown; spentOn?: unknown },
) {
  return call(expenseRoute.POST, "/api/expenses", {
    method: "POST",
    cookie,
    body,
  });
}

async function listMonth(cookie: string, month: string) {
  return call(expensesMonthRoute.GET, `/api/expenses/month/${month}`, {
    cookie,
    params: { month },
  });
}

async function remove(cookie: string, id: string) {
  return call(expenseItemRoute.DELETE, `/api/expenses/${id}`, {
    method: "DELETE",
    cookie,
    params: { id },
  });
}

beforeEach(async () => {
  clock.month = "2026-09";
  clock.day = 15;
  await getSql()`truncate "user", households, invites, verification cascade`;
});

describe("logging an expense (spec 019)", () => {
  it("counts against the category's remaining budget, alongside bills", async () => {
    const cookie = await setupOwner();
    const groceries = await idOf(cookie, "Groceries");
    await setAmount(cookie, clock.month, groceries, 70000);

    await addExpense(cookie, {
      categoryId: groceries,
      amountCents: 1250,
      spentOn: `${clock.month}-10`,
    });

    const b = await budget(cookie);
    const line = b.lines.find((l) => l.id === groceries)!;
    expect(line.amountCents).toBe(70000);
    expect(line.expensesCents).toBe(1250);
    expect(line.remainingCents).toBe(68750); // 700 - 12.50, no bills
    expect(b.expensesTotalCents).toBe(1250);
  });

  it("allows an expense larger than what is left, showing negative Left", async () => {
    const cookie = await setupOwner();
    const groceries = await idOf(cookie, "Groceries");
    await setAmount(cookie, clock.month, groceries, 1000);

    const { status } = await addExpense(cookie, {
      categoryId: groceries,
      amountCents: 5000,
      spentOn: `${clock.month}-10`,
    });
    expect(status).toBe(201);

    const b = await budget(cookie);
    const line = b.lines.find((l) => l.id === groceries)!;
    expect(line.remainingCents).toBe(-4000);
  });

  it("rejects an amount below 1 and a malformed date", async () => {
    const cookie = await setupOwner();
    const groceries = await idOf(cookie, "Groceries");

    const zero = await addExpense(cookie, {
      categoryId: groceries,
      amountCents: 0,
      spentOn: `${clock.month}-10`,
    });
    expect(zero.status).toBe(400);

    const badDate = await addExpense(cookie, {
      categoryId: groceries,
      amountCents: 100,
      spentOn: "2026-02-30",
    });
    expect(badDate.status).toBe(400);
  });

  it("rejects a future date", async () => {
    const cookie = await setupOwner();
    const groceries = await idOf(cookie, "Groceries");

    const { status, json } = await addExpense(cookie, {
      categoryId: groceries,
      amountCents: 100,
      spentOn: `${clock.month}-16`, // clock.day is 15
    });
    expect(status).toBe(400);
    expect(String(json.error)).toMatch(/future/);
  });

  it("rejects a category not active in the expense's month", async () => {
    const cookie = await setupOwner();
    const groceries = await idOf(cookie, "Groceries");

    // Groceries starts this month; a date before it existed is rejected.
    const { status } = await addExpense(cookie, {
      categoryId: groceries,
      amountCents: 100,
      spentOn: "2026-08-10",
    });
    expect(status).toBe(404);
  });

  it("accepts a past month's expense and counts it in that month, not the current one", async () => {
    const cookie = await setupOwner();
    const groceries = await idOf(cookie, "Groceries"); // active from 2026-09

    // Move "now" to October, then log an expense dated in September — a past
    // month where the category was active. It must be accepted (past months
    // are not read-only for facts) and counted in September, not October.
    clock.month = "2026-10";
    clock.day = 5;
    const { status } = await addExpense(cookie, {
      categoryId: groceries,
      amountCents: 100,
      spentOn: "2026-09-20",
    });
    expect(status).toBe(201);

    const october = await budget(cookie, "2026-10");
    expect(october.expensesTotalCents).toBe(0);
    const september = await budget(cookie, "2026-09");
    expect(september.expensesTotalCents).toBe(100);
  });

  it("lists the month's expenses newest first", async () => {
    const cookie = await setupOwner();
    const groceries = await idOf(cookie, "Groceries");
    const dining = await idOf(cookie, "Dining out");

    await addExpense(cookie, { categoryId: groceries, amountCents: 100, spentOn: `${clock.month}-05` });
    await addExpense(cookie, { categoryId: dining, amountCents: 250, spentOn: `${clock.month}-12` });

    const { status, json } = await listMonth(cookie, clock.month);
    expect(status).toBe(200);
    const list = json.expenses as { spentOn: string; categoryName: string; amountCents: number }[];
    expect(list).toHaveLength(2);
    expect(list[0].spentOn).toBe(`${clock.month}-12`);
    expect(list[1].spentOn).toBe(`${clock.month}-05`);
    expect(json.totalCents).toBe(350);
  });

  it("any member can delete any expense", async () => {
    const ownerCookie = await setupOwner();
    const { cookie: memberCookie } = await joinAsMember(ownerCookie);
    const groceries = await idOf(ownerCookie, "Groceries");

    const { json } = await addExpense(ownerCookie, {
      categoryId: groceries,
      amountCents: 100,
      spentOn: `${clock.month}-10`,
    });
    const id = (json.expense as { id: string }).id;

    const { status } = await remove(memberCookie, id);
    expect(status).toBe(200);

    const b = await budget(ownerCookie);
    expect(b.expensesTotalCents).toBe(0);
  });

  it("a signed-in non-member gets 403, not a leak", async () => {
    const ownerCookie = await setupOwner();
    const groceries = await idOf(ownerCookie, "Groceries");
    const { json } = await addExpense(ownerCookie, {
      categoryId: groceries,
      amountCents: 100,
      spentOn: `${clock.month}-10`,
    });
    const id = (json.expense as { id: string }).id;

    // A signed-in user who is not a member of the household is rejected at
    // requireHousehold before the expense is even looked up.
    await getDb().transaction((tx) =>
      insertUserWithPassword(tx, {
        name: "Stranger",
        email: "stranger@example.com",
        password: "stranger password",
      }),
    );
    const stranger = cookieOf(
      await signInResponse("stranger@example.com", "stranger password", new Headers()),
    );
    expect((await remove(stranger, id)).status).toBe(403);
  });
});
