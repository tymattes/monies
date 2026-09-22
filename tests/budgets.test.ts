import { beforeEach, describe, expect, it, vi } from "vitest";

// Control "today" so tests can move between months.
const clock = vi.hoisted(() => ({ month: "2026-09" }));
vi.mock("@/lib/months", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/months")>()),
  currentMonth: () => clock.month,
}));

import * as allocationRoute from "@/app/api/budgets/[month]/allocations/[categoryId]/route";
import * as budgetRoute from "@/app/api/budgets/[month]/route";
import * as categoryRoute from "@/app/api/categories/[id]/route";
import * as categoriesRoute from "@/app/api/categories/route";
import * as householdRoute from "@/app/api/household/route";
import * as setupRoute from "@/app/api/setup/route";
import { getDb, getSql } from "@/db";
import { categories } from "@/db/schema";
import { insertUserWithPassword, signInResponse } from "@/lib/accounts";
import { STARTER_CATEGORIES } from "@/lib/categories";
import { formatMoney, parseMoney } from "@/lib/money";
import { call, cookieOf, joinAsMember, OWNER, setupOwner } from "./helpers";

type Line = { id: string; name: string; amountCents: number };

async function budget(cookie: string, month: string) {
  const r = await call(budgetRoute.GET, `/api/budgets/${month}`, {
    cookie,
    params: { month },
  });
  return { ...r, lines: (r.json.categories ?? []) as Line[] };
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
  amountCents: unknown,
) {
  return call(allocationRoute.PUT, `/api/budgets/${month}/allocations/${categoryId}`, {
    method: "PUT",
    cookie,
    params: { month, categoryId },
    body: { amountCents },
  });
}

const amountIn = async (cookie: string, month: string, name: string) =>
  (await budget(cookie, month)).lines.find((l) => l.name === name)?.amountCents;

async function patchCategory(cookie: string, id: string, body: unknown) {
  return call(categoryRoute.PATCH, `/api/categories/${id}`, {
    method: "PATCH",
    cookie,
    params: { id },
    body,
  });
}

async function addCategory(cookie: string, name: string) {
  return call(categoriesRoute.POST, "/api/categories", {
    method: "POST",
    cookie,
    body: { name },
  });
}

beforeEach(async () => {
  clock.month = "2026-09";
  await getSql()`truncate "user", households, invites, verification cascade`;
});

describe("setup", () => {
  it("creates the starter categories and defaults to USD", async () => {
    const cookie = await setupOwner();
    const { lines, json } = await budget(cookie, "2026-09");
    expect(lines.map((l) => l.name)).toEqual(STARTER_CATEGORIES);
    expect(lines.every((l) => l.amountCents === 0)).toBe(true);
    expect(json.currency).toBe("USD");
    expect(json.totalCents).toBe(0);
    expect(json.editable).toBe(true);
  });

  it("accepts a household currency and rejects invalid ones", async () => {
    const bad = await call(setupRoute.POST, "/api/setup", {
      method: "POST",
      body: { ...OWNER, currency: "ZZZ" },
    });
    expect(bad.status).toBe(400);
    const ok = await call(setupRoute.POST, "/api/setup", {
      method: "POST",
      body: { ...OWNER, currency: "EUR" },
    });
    expect(ok.status).toBe(201);
    const me = await call(householdRoute.GET, "/api/household", { cookie: cookieOf(ok.res) });
    expect(me.json.household).toMatchObject({ currency: "EUR" });
  });
});

describe("time-versioned allocations", () => {
  it("carries an amount into later months", async () => {
    const cookie = await setupOwner();
    const groceries = await idOf(cookie, "Groceries");
    expect((await setAmount(cookie, "2026-09", groceries, 50000)).status).toBe(200);

    expect(await amountIn(cookie, "2026-09", "Groceries")).toBe(50000);
    expect(await amountIn(cookie, "2026-10", "Groceries")).toBe(50000);
    expect(await amountIn(cookie, "2027-03", "Groceries")).toBe(50000);
    expect((await budget(cookie, "2026-10")).json.totalCents).toBe(50000);
  });

  it("leaves earlier months unchanged when a future month changes", async () => {
    const cookie = await setupOwner();
    const groceries = await idOf(cookie, "Groceries");
    await setAmount(cookie, "2026-09", groceries, 50000);
    await setAmount(cookie, "2026-11", groceries, 60000);

    expect(await amountIn(cookie, "2026-09", "Groceries")).toBe(50000);
    expect(await amountIn(cookie, "2026-10", "Groceries")).toBe(50000);
    expect(await amountIn(cookie, "2026-11", "Groceries")).toBe(60000);
    expect(await amountIn(cookie, "2026-12", "Groceries")).toBe(60000);
  });

  it("overwrites an allocation set twice for the same month", async () => {
    const cookie = await setupOwner();
    const groceries = await idOf(cookie, "Groceries");
    await setAmount(cookie, "2026-09", groceries, 100);
    await setAmount(cookie, "2026-09", groceries, 250);
    expect(await amountIn(cookie, "2026-09", "Groceries")).toBe(250);
  });

  it("keeps past months accurate once time moves on", async () => {
    const cookie = await setupOwner();
    const groceries = await idOf(cookie, "Groceries");
    await setAmount(cookie, "2026-09", groceries, 50000);

    clock.month = "2026-10";
    const before = await budget(cookie, "2026-09");
    expect(before.json.editable).toBe(false);

    expect((await setAmount(cookie, "2026-10", groceries, 70000)).status).toBe(200);
    const after = await budget(cookie, "2026-09");
    expect(after.lines).toEqual(before.lines);
    expect(await amountIn(cookie, "2026-10", "Groceries")).toBe(70000);

    const rewrite = await setAmount(cookie, "2026-09", groceries, 1);
    expect(rewrite.status).toBe(400);
    expect(rewrite.json.error).toMatch(/read-only/);
    expect(await amountIn(cookie, "2026-09", "Groceries")).toBe(50000);
  });

  it("shows nothing before the household existed", async () => {
    const cookie = await setupOwner();
    const { lines, json } = await budget(cookie, "2026-08");
    expect(lines).toEqual([]);
    expect(json.editable).toBe(false);
  });

  it.each([
    ["negative", -1],
    ["fractional", 12.5],
    ["a string", "500"],
    ["null", null],
    ["too large", 2_000_000_001],
  ])("rejects an amount that is %s", async (_label, value) => {
    const cookie = await setupOwner();
    const groceries = await idOf(cookie, "Groceries");
    expect((await setAmount(cookie, "2026-09", groceries, value)).status).toBe(400);
    expect(await amountIn(cookie, "2026-09", "Groceries")).toBe(0);
  });

  it.each(["2026-13", "2026-00", "26-09", "2026-9", "abcd", "1999-01"])(
    "rejects the month %s",
    async (month) => {
      const cookie = await setupOwner();
      expect((await budget(cookie, month)).status).toBe(400);
    },
  );

  it("404s for an unknown category", async () => {
    const cookie = await setupOwner();
    const missing = "00000000-0000-0000-0000-000000000000";
    expect((await setAmount(cookie, "2026-09", missing, 100)).status).toBe(404);
  });
});

describe("categories", () => {
  it("enforces unique names case-insensitively, but lets archived names be reused", async () => {
    const cookie = await setupOwner();
    expect((await addCategory(cookie, "groceries")).status).toBe(409);
    expect((await addCategory(cookie, "Pets")).status).toBe(201);

    const pets = await idOf(cookie, "Pets");
    expect((await patchCategory(cookie, pets, { name: "GROCERIES" })).status).toBe(409);

    const groceries = await idOf(cookie, "Groceries");
    await patchCategory(cookie, groceries, { archived: true });
    expect((await addCategory(cookie, "Groceries")).status).toBe(201);
    // The archived one can't come back while an active one holds the name.
    expect((await patchCategory(cookie, groceries, { archived: false })).status).toBe(409);
  });

  it("renames everywhere, including past months", async () => {
    const cookie = await setupOwner();
    const groceries = await idOf(cookie, "Groceries");
    await setAmount(cookie, "2026-09", groceries, 500);
    clock.month = "2026-10";
    expect((await patchCategory(cookie, groceries, { name: "Food" })).status).toBe(204);
    expect(await amountIn(cookie, "2026-09", "Food")).toBe(500);
    expect(await amountIn(cookie, "2026-10", "Food")).toBe(500);
  });

  it("hides an archived category from this month on, but not from history", async () => {
    const cookie = await setupOwner();
    const groceries = await idOf(cookie, "Groceries");
    await setAmount(cookie, "2026-09", groceries, 50000);

    clock.month = "2026-10";
    expect((await patchCategory(cookie, groceries, { archived: true })).status).toBe(204);

    expect(await amountIn(cookie, "2026-09", "Groceries")).toBe(50000);
    expect(await amountIn(cookie, "2026-10", "Groceries")).toBeUndefined();
    expect(await amountIn(cookie, "2026-11", "Groceries")).toBeUndefined();
    expect((await setAmount(cookie, "2026-10", groceries, 1)).status).toBe(404);

    // Restoring brings it back, with its old amount.
    await patchCategory(cookie, groceries, { archived: false });
    expect(await amountIn(cookie, "2026-10", "Groceries")).toBe(50000);
  });

  it("never hard-deletes: archived categories stay in the database", async () => {
    const cookie = await setupOwner();
    const groceries = await idOf(cookie, "Groceries");
    await patchCategory(cookie, groceries, { archived: true });
    const rows = await getDb().select().from(categories);
    expect(rows.find((r) => r.id === groceries)?.archivedFrom).toBe("2026-09-01");
  });

  it("reorders active categories", async () => {
    const cookie = await setupOwner();
    const other = await idOf(cookie, "Other");
    expect((await patchCategory(cookie, other, { position: 0 })).status).toBe(204);
    const names = (await budget(cookie, "2026-09")).lines.map((l) => l.name);
    expect(names.slice(0, 3)).toEqual(["Other", "Housing", "Groceries"]);
    expect(names).toHaveLength(STARTER_CATEGORIES.length);

    await patchCategory(cookie, other, { position: 999 });
    const last = (await budget(cookie, "2026-09")).lines.map((l) => l.name);
    expect(last.at(-1)).toBe("Other");
  });

  it("appends new categories at the end", async () => {
    const cookie = await setupOwner();
    await addCategory(cookie, "Pets");
    const names = (await budget(cookie, "2026-09")).lines.map((l) => l.name);
    expect(names.at(-1)).toBe("Pets");
  });

  it("validates patch bodies", async () => {
    const cookie = await setupOwner();
    const id = await idOf(cookie, "Groceries");
    expect((await patchCategory(cookie, id, {})).status).toBe(400);
    expect((await patchCategory(cookie, id, { archived: "yes" })).status).toBe(400);
    expect((await patchCategory(cookie, id, { position: -1 })).status).toBe(400);
    expect((await patchCategory(cookie, id, { name: "  " })).status).toBe(400);
    const missing = "00000000-0000-0000-0000-000000000000";
    expect((await patchCategory(cookie, missing, { name: "x" })).status).toBe(404);
  });
});

describe("access control", () => {
  it("rejects signed-out requests to every new route", async () => {
    await setupOwner();
    const id = "00000000-0000-0000-0000-000000000000";
    const results = await Promise.all([
      call(categoriesRoute.GET, "/api/categories"),
      call(categoriesRoute.POST, "/api/categories", { method: "POST", body: { name: "x" } }),
      call(categoryRoute.PATCH, `/api/categories/${id}`, { method: "PATCH", params: { id }, body: { name: "x" } }),
      call(budgetRoute.GET, "/api/budgets/2026-09", { params: { month: "2026-09" } }),
      call(allocationRoute.PUT, `/api/budgets/2026-09/allocations/${id}`, {
        method: "PUT",
        params: { month: "2026-09", categoryId: id },
        body: { amountCents: 1 },
      }),
    ]);
    expect(results.map((r) => r.status)).toEqual(Array(5).fill(401));
  });

  it("rejects a signed-in user who is not a household member", async () => {
    await setupOwner();
    await getDb().transaction((tx) =>
      insertUserWithPassword(tx, {
        name: "Stranger",
        email: "stranger@example.com",
        password: "stranger password",
      }),
    );
    const cookie = cookieOf(await signInResponse("stranger@example.com", "stranger password", new Headers()));
    expect((await call(categoriesRoute.GET, "/api/categories", { cookie })).status).toBe(403);
    expect((await budget(cookie, "2026-09")).status).toBe(403);
  });

  it("lets regular members manage categories and budgets", async () => {
    const owner = await setupOwner();
    const { cookie } = await joinAsMember(owner);
    expect((await addCategory(cookie, "Pets")).status).toBe(201);
    const pets = await idOf(cookie, "Pets");
    expect((await setAmount(cookie, "2026-09", pets, 2500)).status).toBe(200);
    expect(await amountIn(owner, "2026-09", "Pets")).toBe(2500);
    expect((await patchCategory(cookie, pets, { archived: true })).status).toBe(204);
  });
});

describe("money helpers", () => {
  it("parses and formats by the currency's minor unit", () => {
    expect(parseMoney("12.34", "USD")).toBe(1234);
    expect(parseMoney("$1,250.5", "USD")).toBe(125050);
    expect(parseMoney("40", "USD")).toBe(4000);
    expect(parseMoney("12.345", "USD")).toBeNull();
    expect(parseMoney("-5", "USD")).toBeNull();
    expect(parseMoney("abc", "USD")).toBeNull();
    expect(parseMoney("", "USD")).toBeNull();
    expect(parseMoney("500", "JPY")).toBe(500);
    expect(parseMoney("500.5", "JPY")).toBeNull();
    expect(formatMoney(125050, "USD")).toBe("$1,250.50");
  });
});
