import { beforeEach, describe, expect, it } from "vitest";
import * as backupRoute from "@/app/api/backup/route";
import * as allocationRoute from "@/app/api/budgets/[month]/allocations/[categoryId]/route";
import * as budgetRoute from "@/app/api/budgets/[month]/route";
import * as billItemRoute from "@/app/api/bills/[month]/items/[id]/route";
import * as billsRoute from "@/app/api/bills/route";
import * as categoryRoute from "@/app/api/categories/[id]/route";
import * as expensesRoute from "@/app/api/expenses/route";
import * as goalAmountRoute from "@/app/api/goals/month/[month]/amounts/[id]/route";
import * as goalCheckinRoute from "@/app/api/goals/month/[month]/checkins/[id]/route";
import * as householdRestoreRoute from "@/app/api/household/restore/route";
import * as householdRoute from "@/app/api/household/route";
import * as incomeSourceAmountRoute from "@/app/api/income/[month]/sources/[id]/route";
import * as depositsRoute from "@/app/api/income/sources/[id]/deposits/route";
import * as incomeSourcesRoute from "@/app/api/income/sources/route";
import * as restoreRoute from "@/app/api/restore/route";
import * as setupRoute from "@/app/api/setup/route";
import { getSql } from "@/db";
import { currentMonth, addMonths } from "@/lib/months";
import type { BackupFile } from "@/lib/backup";
import { call, cookieOf, joinAsMember, OWNER, setupOwner } from "./helpers";

beforeEach(async () => {
  await getSql()`truncate "user", households, invites, verification cascade`;
});

const M = currentMonth();
const NEXT = addMonths(M, 1);
const MEMBER_PASSWORD = "another good password";

// Builds a household with at least one row in every table the backup covers:
// two members, a category with two time-versioned budget allocations, a
// bill, a fixed and a variable income source, a goal amount and check-in,
// and a logged expense.
async function seedFullHousehold() {
  const ownerCookie = await setupOwner();
  const { cookie: memberCookie, userId: memberId } = await joinAsMember(ownerCookie);

  const me = await call(householdRoute.GET, "/api/household", { cookie: ownerCookie });
  const ownerId = (me.json.me as { id: string }).id;

  const budget = await call(budgetRoute.GET, `/api/budgets/${M}`, { cookie: ownerCookie, params: { month: M } });
  const categories = budget.json.categories as { id: string; name: string }[];
  const goals = budget.json.goals as { id: string; name: string }[];
  const categoryId = categories.find((c) => c.name === "Groceries")!.id;
  const goalId = goals.find((g) => g.name === "Savings")!.id;

  // Two budget_allocations rows for the same category (spec 044: history,
  // not just the current month, must round-trip).
  await call(allocationRoute.PUT, `/api/budgets/${M}/allocations/${categoryId}`, {
    method: "PUT", cookie: ownerCookie, params: { month: M, categoryId }, body: { amountCents: 50000 },
  });
  await call(allocationRoute.PUT, `/api/budgets/${NEXT}/allocations/${categoryId}`, {
    method: "PUT", cookie: ownerCookie, params: { month: NEXT, categoryId }, body: { amountCents: 60000 },
  });

  // An archived category, to check archivedFrom round-trips.
  const otherCategoryId = categories.find((c) => c.name === "Entertainment")!.id;
  await call(categoryRoute.PATCH, `/api/categories/${otherCategoryId}`, {
    method: "PATCH", cookie: ownerCookie, params: { id: otherCategoryId }, body: { archived: true },
  });

  const billCreate = await call(billsRoute.POST, "/api/bills", {
    method: "POST", cookie: ownerCookie,
    body: { name: "Rent", amountCents: 150000, categoryId, paidBy: ownerId },
  });
  const billId = (billCreate.json.bill as { id: string }).id;
  await call(billItemRoute.PUT, `/api/bills/${NEXT}/items/${billId}`, {
    method: "PUT", cookie: ownerCookie, params: { month: NEXT, id: billId },
    body: { amountCents: 160000, intervalMonths: 1, categoryId },
  });

  const fixedSource = await call(incomeSourcesRoute.POST, "/api/income/sources", {
    method: "POST", cookie: ownerCookie, body: { name: "Salary", kind: "fixed" },
  });
  const fixedSourceId = (fixedSource.json.source as { id: string }).id;
  await call(incomeSourceAmountRoute.PUT, `/api/income/${M}/sources/${fixedSourceId}`, {
    method: "PUT", cookie: ownerCookie, params: { month: M, id: fixedSourceId }, body: { amountCents: 500000 },
  });

  const variableSource = await call(incomeSourcesRoute.POST, "/api/income/sources", {
    method: "POST", cookie: memberCookie, body: { name: "Freelance", kind: "variable" },
  });
  const variableSourceId = (variableSource.json.source as { id: string }).id;
  await call(depositsRoute.POST, `/api/income/sources/${variableSourceId}/deposits`, {
    method: "POST", cookie: memberCookie, params: { id: variableSourceId },
    body: { receivedOn: `${M}-05`, amountCents: 100000, note: "Logo job" },
  });

  await call(goalAmountRoute.PUT, `/api/goals/month/${M}/amounts/${goalId}`, {
    method: "PUT", cookie: ownerCookie, params: { month: M, id: goalId }, body: { amountCents: 20000 },
  });
  await call(goalCheckinRoute.PUT, `/api/goals/month/${M}/checkins/${goalId}`, {
    method: "PUT", cookie: ownerCookie, params: { month: M, id: goalId }, body: { checked: true },
  });

  await call(expensesRoute.POST, "/api/expenses", {
    method: "POST", cookie: ownerCookie,
    body: { categoryId, amountCents: 4250, spentOn: `${M}-02`, description: "Market" },
  });

  return { ownerCookie, memberCookie, ownerId, memberId, categoryId, otherCategoryId, billId, goalId };
}

async function exportBackup(cookie: string): Promise<BackupFile> {
  const res = await call(backupRoute.GET, "/api/backup", { cookie });
  expect(res.status).toBe(200);
  return res.json as unknown as BackupFile;
}

describe("GET /api/backup", () => {
  it("is owner-only", async () => {
    const { memberCookie } = await seedFullHousehold();
    const res = await call(backupRoute.GET, "/api/backup", { cookie: memberCookie });
    expect(res.status).toBe(403);
  });

  it("exports every table with real history, not just current values", async () => {
    const { ownerCookie, categoryId, otherCategoryId, billId, goalId } = await seedFullHousehold();
    const backup = await exportBackup(ownerCookie);

    expect(backup.schemaVersion).toBe(1);
    expect(backup.household.name).toBe(OWNER.householdName);
    expect(backup.members).toHaveLength(2);
    for (const m of backup.members) expect(m.passwordHash.length).toBeGreaterThan(10);
    expect(backup.members.filter((m) => m.role === "owner")).toHaveLength(1);

    expect(backup.categories.find((c) => c.id === otherCategoryId)?.archivedFrom).not.toBeNull();
    expect(backup.budgetAllocations.filter((a) => a.categoryId === categoryId)).toHaveLength(2);
    expect(backup.bills.find((b) => b.id === billId)).toBeTruthy();
    expect(backup.billVersions.filter((v) => v.billId === billId)).toHaveLength(2);
    expect(backup.incomeSources).toHaveLength(2);
    expect(backup.incomeAmounts).toHaveLength(1);
    expect(backup.incomeDeposits).toHaveLength(1);
    expect(backup.goalAmounts.find((a) => a.goalId === goalId)).toBeTruthy();
    expect(backup.goalCheckins.find((c) => c.goalId === goalId)).toBeTruthy();
    expect(backup.expenses).toHaveLength(1);
  });
});

describe("POST /api/restore (fresh instance)", () => {
  it("recreates the household onto an empty instance", async () => {
    const seeded = await seedFullHousehold();
    const backup = await exportBackup(seeded.ownerCookie);

    await getSql()`truncate "user", households, invites, verification cascade`;
    expect((await call(setupRoute.GET, "/api/setup")).json.needsSetup).toBe(true);

    const restored = await call(restoreRoute.POST, "/api/restore", { method: "POST", body: backup });
    expect(restored.status).toBe(201);
    expect((await call(setupRoute.GET, "/api/setup")).json.needsSetup).toBe(false);

    const signIn = await call(householdRoute.GET, "/api/household");
    expect(signIn.status).toBe(401); // no cookie issued by restore itself

    const { call: authCall } = await import("@/app/api/auth/[...all]/route").then((m) => ({ call: m.POST }));
    const ownerSignIn = await call(authCall, "/api/auth/sign-in/email", {
      method: "POST", body: { email: OWNER.email, password: OWNER.password },
    });
    expect(ownerSignIn.status).toBe(200);
    const ownerCookie = cookieOf(ownerSignIn.res);

    const me = await call(householdRoute.GET, "/api/household", { cookie: ownerCookie });
    expect(me.json.household).toMatchObject({ name: OWNER.householdName });

    const memberSignIn = await call(authCall, "/api/auth/sign-in/email", {
      method: "POST", body: { email: "member@example.com", password: MEMBER_PASSWORD },
    });
    expect(memberSignIn.status).toBe(200);

    const budget = await call(budgetRoute.GET, `/api/budgets/${M}`, { cookie: ownerCookie, params: { month: M } });
    const category = (budget.json.categories as { id: string; name: string; amountCents: number }[]).find(
      (c) => c.name === "Groceries",
    )!;
    expect(category.amountCents).toBe(50000);
  });

  it("rejects when a household already exists", async () => {
    const seeded = await seedFullHousehold();
    const backup = await exportBackup(seeded.ownerCookie);
    const attempt = await call(restoreRoute.POST, "/api/restore", { method: "POST", body: backup });
    expect(attempt.status).toBe(409);
  });

  it("rejects a schemaVersion newer than this build understands", async () => {
    const seeded = await seedFullHousehold();
    const backup = await exportBackup(seeded.ownerCookie);
    await getSql()`truncate "user", households, invites, verification cascade`;
    const attempt = await call(restoreRoute.POST, "/api/restore", {
      method: "POST", body: { ...backup, schemaVersion: 99 },
    });
    expect(attempt.status).toBe(400);
  });

  it("rejects a malformed date", async () => {
    const seeded = await seedFullHousehold();
    const backup = await exportBackup(seeded.ownerCookie);
    await getSql()`truncate "user", households, invites, verification cascade`;
    const corrupted = { ...backup, categories: backup.categories.map((c) => ({ ...c, startMonth: "not-a-date" })) };
    const attempt = await call(restoreRoute.POST, "/api/restore", { method: "POST", body: corrupted });
    expect(attempt.status).toBe(400);
  });

  it("rejects a negative amount", async () => {
    const seeded = await seedFullHousehold();
    const backup = await exportBackup(seeded.ownerCookie);
    await getSql()`truncate "user", households, invites, verification cascade`;
    const corrupted = {
      ...backup,
      budgetAllocations: backup.budgetAllocations.map((a) => ({ ...a, amountCents: -1 })),
    };
    const attempt = await call(restoreRoute.POST, "/api/restore", { method: "POST", body: corrupted });
    expect(attempt.status).toBe(400);
  });

  it("rejects a dangling foreign-key reference", async () => {
    const seeded = await seedFullHousehold();
    const backup = await exportBackup(seeded.ownerCookie);
    await getSql()`truncate "user", households, invites, verification cascade`;
    const corrupted = {
      ...backup,
      expenses: backup.expenses.map((e) => ({ ...e, categoryId: "00000000-0000-0000-0000-000000000000" })),
    };
    const attempt = await call(restoreRoute.POST, "/api/restore", { method: "POST", body: corrupted });
    expect(attempt.status).toBe(400);
  });

  it("leaves the instance untouched after a rejected restore", async () => {
    await getSql()`truncate "user", households, invites, verification cascade`;
    const attempt = await call(restoreRoute.POST, "/api/restore", {
      method: "POST", body: { schemaVersion: 1, household: {} },
    });
    expect(attempt.status).toBe(400);
    expect((await call(setupRoute.GET, "/api/setup")).json.needsSetup).toBe(true);
  });
});

describe("POST /api/household/restore (live instance)", () => {
  it("requires the exact household name and touches nothing on a mismatch", async () => {
    const seeded = await seedFullHousehold();
    const backup = await exportBackup(seeded.ownerCookie);
    const wrong = await call(householdRestoreRoute.POST, "/api/household/restore", {
      method: "POST", cookie: seeded.ownerCookie,
      body: { confirmHouseholdName: "Not It", backup },
    });
    expect(wrong.status).toBe(400);
    const stillThere = await call(householdRoute.GET, "/api/household", { cookie: seeded.ownerCookie });
    expect(stillThere.status).toBe(200);
  });

  it("is owner-only", async () => {
    const seeded = await seedFullHousehold();
    const backup = await exportBackup(seeded.ownerCookie);
    const attempt = await call(householdRestoreRoute.POST, "/api/household/restore", {
      method: "POST", cookie: seeded.memberCookie,
      body: { confirmHouseholdName: OWNER.householdName, backup },
    });
    expect(attempt.status).toBe(403);
  });

  it("replaces everything and invalidates the acting owner's own session", async () => {
    const seeded = await seedFullHousehold();
    const backup = await exportBackup(seeded.ownerCookie);

    // Change something after the backup was taken, so we can tell it reverted.
    await call(householdRoute.PATCH, "/api/household", {
      method: "PATCH", cookie: seeded.ownerCookie, body: { name: "Changed Before Restore" },
    });

    const restored = await call(householdRestoreRoute.POST, "/api/household/restore", {
      method: "POST", cookie: seeded.ownerCookie,
      body: { confirmHouseholdName: "Changed Before Restore", backup },
    });
    expect(restored.status).toBe(200);

    // The session that performed the restore no longer exists.
    const staleSession = await call(householdRoute.GET, "/api/household", { cookie: seeded.ownerCookie });
    expect(staleSession.status).toBe(401);

    const { POST: signInPost } = await import("@/app/api/auth/[...all]/route");
    const ownerSignIn = await call(signInPost, "/api/auth/sign-in/email", {
      method: "POST", body: { email: OWNER.email, password: OWNER.password },
    });
    expect(ownerSignIn.status).toBe(200);
    const freshCookie = cookieOf(ownerSignIn.res);
    const me = await call(householdRoute.GET, "/api/household", { cookie: freshCookie });
    expect(me.json.household).toMatchObject({ name: OWNER.householdName });
  });
});
