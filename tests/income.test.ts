import { beforeEach, describe, expect, it, vi } from "vitest";

// Control "today" so tests can move between months.
const clock = vi.hoisted(() => ({ month: "2026-09" }));
vi.mock("@/lib/months", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/months")>()),
  currentMonth: () => clock.month,
}));

import * as budgetRoute from "@/app/api/budgets/[month]/route";
import * as monthRoute from "@/app/api/income/[month]/route";
import * as amountRoute from "@/app/api/income/[month]/sources/[id]/route";
import * as depositRoute from "@/app/api/income/deposits/[id]/route";
import * as sourceRoute from "@/app/api/income/sources/[id]/route";
import * as depositsRoute from "@/app/api/income/sources/[id]/deposits/route";
import * as sourcesRoute from "@/app/api/income/sources/route";
import * as householdRoute from "@/app/api/household/route";
import * as memberRoute from "@/app/api/members/[userId]/route";
import * as allocationRoute from "@/app/api/budgets/[month]/allocations/[categoryId]/route";
import { getSql } from "@/db";
import { insertUserWithPassword, signInResponse } from "@/lib/accounts";
import { getDb } from "@/db";
import { call, cookieOf, invite, join, joinAsMember, setupOwner } from "./helpers";

type Source = {
  id: string;
  name: string;
  kind: "fixed" | "variable";
  amountCents: number;
  canEdit: boolean;
  deposits: { id: string; receivedOn: string; amountCents: number; note: string | null }[];
};
type Group = {
  memberId: string | null;
  name: string;
  isSelf: boolean;
  canAdd: boolean;
  totalCents: number;
  sources: Source[];
};

async function month(cookie: string, m: string) {
  const r = await call(monthRoute.GET, `/api/income/${m}`, { cookie, params: { month: m } });
  return { ...r, groups: (r.json.members ?? []) as Group[], total: r.json.totalCents as number };
}

const groupOf = (groups: Group[], name: string) => groups.find((g) => g.name === name);

async function addSource(cookie: string, body: unknown) {
  return call(sourcesRoute.POST, "/api/income/sources", { method: "POST", cookie, body });
}

async function makeSource(cookie: string, name: string, kind: "fixed" | "variable", memberId?: string) {
  const r = await addSource(cookie, { name, kind, memberId });
  expect(r.status).toBe(201);
  return (r.json.source as { id: string }).id;
}

async function setAmount(cookie: string, m: string, id: string, amountCents: unknown) {
  return call(amountRoute.PUT, `/api/income/${m}/sources/${id}`, {
    method: "PUT",
    cookie,
    params: { month: m, id },
    body: { amountCents },
  });
}

async function deposit(cookie: string, id: string, body: unknown) {
  return call(depositsRoute.POST, `/api/income/sources/${id}/deposits`, {
    method: "POST",
    cookie,
    params: { id },
    body,
  });
}

async function patchDeposit(cookie: string, id: string, body: unknown) {
  return call(depositRoute.PATCH, `/api/income/deposits/${id}`, {
    method: "PATCH",
    cookie,
    params: { id },
    body,
  });
}

async function patchSource(cookie: string, id: string, body: unknown) {
  return call(sourceRoute.PATCH, `/api/income/sources/${id}`, {
    method: "PATCH",
    cookie,
    params: { id },
    body,
  });
}

async function idOfUser(cookie: string) {
  const me = await call(householdRoute.GET, "/api/household", { cookie });
  return (me.json.me as { id: string }).id;
}

const totalOf = async (cookie: string, m: string, name: string) =>
  groupOf((await month(cookie, m)).groups, name)?.totalCents;

beforeEach(async () => {
  clock.month = "2026-09";
  await getSql()`truncate "user", households, invites, verification cascade`;
});

describe("creating sources", () => {
  it("lets a member add fixed and variable sources for themselves", async () => {
    const owner = await setupOwner();
    const { cookie } = await joinAsMember(owner);
    await makeSource(cookie, "Salary", "fixed");
    await makeSource(cookie, "Freelance", "variable");
    const g = groupOf((await month(owner, "2026-09")).groups, "Mia Member");
    expect(g?.sources.map((s) => [s.name, s.kind])).toEqual([
      ["Salary", "fixed"],
      ["Freelance", "variable"],
    ]);
    expect(g?.isSelf).toBe(false); // viewed as the owner
  });

  it("lets an owner add income for any member, but a member only for themselves", async () => {
    const owner = await setupOwner();
    const ownerId = await idOfUser(owner);
    const member = await joinAsMember(owner);
    await makeSource(owner, "Salary", "fixed", member.userId);

    const forOwner = await addSource(member.cookie, { name: "Nope", kind: "fixed", memberId: ownerId });
    expect(forOwner.status).toBe(403);
    const own = await addSource(member.cookie, { name: "Mine", kind: "fixed", memberId: member.userId });
    expect(own.status).toBe(201);
  });

  it("validates input", async () => {
    const owner = await setupOwner();
    expect((await addSource(owner, { name: "x", kind: "weekly" })).status).toBe(400);
    expect((await addSource(owner, { name: " ", kind: "fixed" })).status).toBe(400);
    expect((await addSource(owner, { name: "x", kind: "fixed", memberId: 5 })).status).toBe(400);
    const missing = "not-a-member";
    expect((await addSource(owner, { name: "x", kind: "fixed", memberId: missing })).status).toBe(404);
  });

  it("keeps names unique per member, case-insensitively", async () => {
    const owner = await setupOwner();
    const member = await joinAsMember(owner);
    await makeSource(owner, "Salary", "fixed");
    expect((await addSource(owner, { name: "SALARY", kind: "variable" })).status).toBe(409);
    // A different member can use the same name.
    expect((await addSource(member.cookie, { name: "Salary", kind: "fixed" })).status).toBe(201);
  });
});

describe("fixed income (time-versioned)", () => {
  it("carries into later months and leaves earlier months alone", async () => {
    const owner = await setupOwner();
    const id = await makeSource(owner, "Salary", "fixed");
    expect((await setAmount(owner, "2026-09", id, 400000)).status).toBe(200);

    expect(await totalOf(owner, "2026-09", "Olive Owner")).toBe(400000);
    expect(await totalOf(owner, "2026-10", "Olive Owner")).toBe(400000);

    await setAmount(owner, "2026-11", id, 450000);
    expect(await totalOf(owner, "2026-10", "Olive Owner")).toBe(400000);
    expect(await totalOf(owner, "2026-11", "Olive Owner")).toBe(450000);
    expect(await totalOf(owner, "2026-12", "Olive Owner")).toBe(450000);
    expect((await month(owner, "2026-11")).total).toBe(450000);
  });

  it("keeps past months accurate and read-only once time moves on", async () => {
    const owner = await setupOwner();
    const id = await makeSource(owner, "Salary", "fixed");
    await setAmount(owner, "2026-09", id, 400000);

    clock.month = "2026-10";
    const before = await month(owner, "2026-09");
    expect(before.json.editable).toBe(false);
    expect((await setAmount(owner, "2026-10", id, 500000)).status).toBe(200);
    expect((await month(owner, "2026-09")).groups).toEqual(before.groups);

    const rewrite = await setAmount(owner, "2026-09", id, 1);
    expect(rewrite.status).toBe(400);
    expect(rewrite.json.error).toMatch(/read-only/);
  });

  it("rejects bad amounts and unknown or variable sources", async () => {
    const owner = await setupOwner();
    const fixed = await makeSource(owner, "Salary", "fixed");
    const variable = await makeSource(owner, "Freelance", "variable");
    for (const bad of [-1, 12.5, "500", null, 2_000_000_001]) {
      expect((await setAmount(owner, "2026-09", fixed, bad)).status).toBe(400);
    }
    expect((await setAmount(owner, "2026-09", variable, 100)).status).toBe(400);
    expect((await setAmount(owner, "2026-09", "00000000-0000-0000-0000-000000000000", 100)).status).toBe(404);
    expect((await setAmount(owner, "2026-13", fixed, 100)).status).toBe(400);
  });
});

describe("variable income (deposits)", () => {
  it("counts deposits in the month of their date only", async () => {
    const owner = await setupOwner();
    const id = await makeSource(owner, "Freelance", "variable");
    expect((await deposit(owner, id, { receivedOn: "2026-09-05", amountCents: 120000, note: "Client A" })).status).toBe(201);
    await deposit(owner, id, { receivedOn: "2026-09-30", amountCents: 30000 });
    await deposit(owner, id, { receivedOn: "2026-10-01", amountCents: 50000 });

    expect(await totalOf(owner, "2026-09", "Olive Owner")).toBe(150000);
    expect(await totalOf(owner, "2026-10", "Olive Owner")).toBe(50000);
    expect(await totalOf(owner, "2026-11", "Olive Owner")).toBe(0);

    const sept = groupOf((await month(owner, "2026-09")).groups, "Olive Owner")!.sources[0];
    expect(sept.deposits.map((d) => [d.receivedOn, d.note])).toEqual([
      ["2026-09-05", "Client A"],
      ["2026-09-30", null],
    ]);
  });

  it("updates only the affected months when a deposit is edited or deleted", async () => {
    const owner = await setupOwner();
    const id = await makeSource(owner, "Freelance", "variable");
    const created = await deposit(owner, id, { receivedOn: "2026-09-05", amountCents: 1000 });
    const depositId = (created.json.deposit as { id: string }).id;

    expect((await patchDeposit(owner, depositId, { receivedOn: "2026-10-02", amountCents: 2500 })).status).toBe(204);
    expect(await totalOf(owner, "2026-09", "Olive Owner")).toBe(0);
    expect(await totalOf(owner, "2026-10", "Olive Owner")).toBe(2500);

    const del = await call(depositRoute.DELETE, `/api/income/deposits/${depositId}`, {
      method: "DELETE",
      cookie: owner,
      params: { id: depositId },
    });
    expect(del.status).toBe(204);
    expect(await totalOf(owner, "2026-10", "Olive Owner")).toBe(0);
  });

  it("rejects bad deposits and deposits on fixed sources", async () => {
    const owner = await setupOwner();
    const variable = await makeSource(owner, "Freelance", "variable");
    const fixed = await makeSource(owner, "Salary", "fixed");
    for (const amountCents of [0, -5, 12.5, "10", null]) {
      expect((await deposit(owner, variable, { receivedOn: "2026-09-05", amountCents })).status).toBe(400);
    }
    for (const receivedOn of ["2026-02-30", "2026-9-5", "yesterday", undefined]) {
      expect((await deposit(owner, variable, { receivedOn, amountCents: 100 })).status).toBe(400);
    }
    expect((await deposit(owner, variable, { receivedOn: "2026-09-05", amountCents: 100, note: "x".repeat(201) })).status).toBe(400);
    expect((await deposit(owner, fixed, { receivedOn: "2026-09-05", amountCents: 100 })).status).toBe(400);
    // Before the source existed.
    expect((await deposit(owner, variable, { receivedOn: "2026-06-05", amountCents: 100 })).status).toBe(400);
  });
});

describe("month view", () => {
  it("combines fixed and variable income into member and household totals", async () => {
    const owner = await setupOwner();
    const member = await joinAsMember(owner);
    const salary = await makeSource(owner, "Salary", "fixed");
    await setAmount(owner, "2026-09", salary, 400000);
    const side = await makeSource(member.cookie, "Side gigs", "variable");
    await deposit(member.cookie, side, { receivedOn: "2026-09-12", amountCents: 25000 });
    const memberSalary = await makeSource(member.cookie, "Salary", "fixed");
    await setAmount(member.cookie, "2026-09", memberSalary, 300000);

    const view = await month(member.cookie, "2026-09");
    expect(groupOf(view.groups, "Olive Owner")?.totalCents).toBe(400000);
    expect(groupOf(view.groups, "Mia Member")?.totalCents).toBe(325000);
    expect(groupOf(view.groups, "Mia Member")?.isSelf).toBe(true);
    expect(view.total).toBe(725000);
    expect(view.json.currency).toBe("USD");
  });

  it("includes members with no income yet", async () => {
    const owner = await setupOwner();
    await joinAsMember(owner);
    const view = await month(owner, "2026-09");
    expect(view.groups.map((g) => g.name)).toEqual(["Olive Owner", "Mia Member"]);
    expect(view.groups.every((g) => g.canAdd)).toBe(true);
  });

  it("shows income and unallocated on the budget", async () => {
    const owner = await setupOwner();
    const salary = await makeSource(owner, "Salary", "fixed");
    await setAmount(owner, "2026-09", salary, 400000);

    const get = () =>
      call(budgetRoute.GET, "/api/budgets/2026-09", { cookie: owner, params: { month: "2026-09" } });
    expect((await get()).json).toMatchObject({ incomeCents: 400000, totalCents: 0, unallocatedCents: 400000 });

    const groceries = ((await get()).json.categories as { id: string; name: string }[]).find((c) => c.name === "Groceries")!;
    const put = (amountCents: number) =>
      call(allocationRoute.PUT, `/api/budgets/2026-09/allocations/${groceries.id}`, {
        method: "PUT",
        cookie: owner,
        params: { month: "2026-09", categoryId: groceries.id },
        body: { amountCents },
      });
    await put(150000);
    expect((await get()).json).toMatchObject({ incomeCents: 400000, totalCents: 150000, unallocatedCents: 250000 });

    // Budgeting more than income goes negative (flagged as over-allocated in the UI).
    await put(500000);
    expect((await get()).json).toMatchObject({ totalCents: 500000, unallocatedCents: -100000 });
  });
});

describe("permissions", () => {
  it("lets everyone view all income but only edit their own (owners edit anyone's)", async () => {
    const owner = await setupOwner();
    const member = await joinAsMember(owner);
    const ownerSource = await makeSource(owner, "Salary", "fixed");
    const memberSource = await makeSource(member.cookie, "Salary", "fixed");
    const ownerVariable = await makeSource(owner, "Freelance", "variable");
    const ownerDeposit = (await deposit(owner, ownerVariable, { receivedOn: "2026-09-05", amountCents: 100 })).json.deposit as { id: string };

    // The member sees the owner's income...
    const seen = groupOf((await month(member.cookie, "2026-09")).groups, "Olive Owner");
    expect(seen?.sources).toHaveLength(2);
    expect(seen?.sources.every((s) => !s.canEdit)).toBe(true);
    expect(seen?.canAdd).toBe(false);

    // ...but cannot change it.
    expect((await setAmount(member.cookie, "2026-09", ownerSource, 1)).status).toBe(403);
    expect((await patchSource(member.cookie, ownerSource, { name: "Hacked" })).status).toBe(403);
    expect((await deposit(member.cookie, ownerVariable, { receivedOn: "2026-09-06", amountCents: 1 })).status).toBe(403);
    expect((await patchDeposit(member.cookie, ownerDeposit.id, { amountCents: 1 })).status).toBe(403);
    expect((await call(depositRoute.DELETE, `/api/income/deposits/${ownerDeposit.id}`, { method: "DELETE", cookie: member.cookie, params: { id: ownerDeposit.id } })).status).toBe(403);

    // The owner can edit the member's income; the member can edit their own.
    expect((await setAmount(owner, "2026-09", memberSource, 5000)).status).toBe(200);
    expect((await setAmount(member.cookie, "2026-09", memberSource, 6000)).status).toBe(200);
    const mine = groupOf((await month(member.cookie, "2026-09")).groups, "Mia Member");
    expect(mine?.sources[0].canEdit).toBe(true);
  });

  it("rejects signed-out users on every route", async () => {
    await setupOwner();
    const id = "00000000-0000-0000-0000-000000000000";
    const results = await Promise.all([
      call(monthRoute.GET, "/api/income/2026-09", { params: { month: "2026-09" } }),
      call(sourcesRoute.GET, "/api/income/sources"),
      call(sourcesRoute.POST, "/api/income/sources", { method: "POST", body: { name: "x", kind: "fixed" } }),
      call(sourceRoute.PATCH, `/api/income/sources/${id}`, { method: "PATCH", params: { id }, body: { name: "x" } }),
      call(amountRoute.PUT, `/api/income/2026-09/sources/${id}`, { method: "PUT", params: { month: "2026-09", id }, body: { amountCents: 1 } }),
      call(depositsRoute.POST, `/api/income/sources/${id}/deposits`, { method: "POST", params: { id }, body: { receivedOn: "2026-09-01", amountCents: 1 } }),
      call(depositRoute.PATCH, `/api/income/deposits/${id}`, { method: "PATCH", params: { id }, body: { amountCents: 1 } }),
      call(depositRoute.DELETE, `/api/income/deposits/${id}`, { method: "DELETE", params: { id } }),
    ]);
    expect(results.map((r) => r.status)).toEqual(Array(8).fill(401));
  });

  it("rejects a signed-in user who is not a household member", async () => {
    await setupOwner();
    await getDb().transaction((tx) =>
      insertUserWithPassword(tx, { name: "Stranger", email: "stranger@example.com", password: "stranger password" }),
    );
    const cookie = cookieOf(await signInResponse("stranger@example.com", "stranger password", new Headers()));
    expect((await month(cookie, "2026-09")).status).toBe(403);
    expect((await call(sourcesRoute.GET, "/api/income/sources", { cookie })).status).toBe(403);
  });
});

describe("archiving", () => {
  it("hides an archived source from this month on but keeps history", async () => {
    const owner = await setupOwner();
    const id = await makeSource(owner, "Salary", "fixed");
    await setAmount(owner, "2026-09", id, 400000);

    clock.month = "2026-10";
    expect((await patchSource(owner, id, { archived: true })).status).toBe(204);
    expect(await totalOf(owner, "2026-09", "Olive Owner")).toBe(400000);
    expect(await totalOf(owner, "2026-10", "Olive Owner")).toBe(0);
    expect((await setAmount(owner, "2026-10", id, 1)).status).toBe(404);

    await patchSource(owner, id, { archived: false });
    expect(await totalOf(owner, "2026-10", "Olive Owner")).toBe(400000);
  });

  it("rejects deposits into a month where the source is archived", async () => {
    const owner = await setupOwner();
    const id = await makeSource(owner, "Freelance", "variable");
    await patchSource(owner, id, { archived: true });
    expect((await deposit(owner, id, { receivedOn: "2026-09-10", amountCents: 100 })).status).toBe(400);
  });
});

describe("removed members", () => {
  it("keeps their income as 'Former member', editable only by owners", async () => {
    const owner = await setupOwner();
    const leaver = await joinAsMember(owner);
    const salary = await makeSource(leaver.cookie, "Salary", "fixed");
    await setAmount(leaver.cookie, "2026-09", salary, 300000);
    const side = await makeSource(leaver.cookie, "Side gigs", "variable");
    await deposit(leaver.cookie, side, { receivedOn: "2026-09-12", amountCents: 20000 });

    const removed = await call(memberRoute.DELETE, `/api/members/${leaver.userId}`, {
      method: "DELETE",
      cookie: owner,
      params: { userId: leaver.userId },
    });
    expect(removed.status).toBe(204);

    const view = await month(owner, "2026-09");
    expect(groupOf(view.groups, "Mia Member")).toBeUndefined();
    const former = groupOf(view.groups, "Former member");
    expect(former?.memberId).toBeNull();
    expect(former?.totalCents).toBe(320000);
    expect(former?.canAdd).toBe(false);
    expect(view.total).toBe(320000);
    // History for past months stays too.
    clock.month = "2026-10";
    expect(await totalOf(owner, "2026-09", "Former member")).toBe(320000);

    // A regular member cannot touch it; the owner can.
    const { token } = await invite(owner);
    const third = await join(token, "third@example.com");
    const thirdCookie = cookieOf(third.res);
    expect((await patchSource(thirdCookie, salary, { name: "Mine now" })).status).toBe(403);
    expect((await setAmount(thirdCookie, "2026-10", salary, 1)).status).toBe(403);
    expect((await setAmount(owner, "2026-10", salary, 310000)).status).toBe(200);
    expect((await patchSource(owner, side, { archived: true })).status).toBe(204);
  });
});
