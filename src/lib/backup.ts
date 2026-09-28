import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import packageJson from "../../package.json";
import { getDb } from "@/db";
import {
  account,
  bills,
  billVersions,
  budgetAllocations,
  categories,
  expenses,
  goalAmounts,
  goalCheckins,
  goals,
  householdMembers,
  households,
  incomeAmounts,
  incomeDeposits,
  incomeSources,
  user,
} from "@/db/schema";
import { MAX_AMOUNT } from "./budgets";
import { GOAL_TYPES, type GoalType } from "./goalTypes";
import { HttpError, isUniqueViolation } from "./http";
import { parseRole } from "./validate";
import { isValidCurrency } from "./money";
import { parseDate } from "./months";

// Bumps only when a future spec changes what this file needs to carry —
// independent of the Drizzle migration count (spec 044).
export const BACKUP_SCHEMA_VERSION = 1;

export type BackupFile = {
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
  household: { id: string; name: string; currency: string };
  members: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    role: "owner" | "member";
    passwordHash: string;
  }[];
  categories: {
    id: string;
    name: string;
    position: number;
    startMonth: string;
    archivedFrom: string | null;
  }[];
  budgetAllocations: {
    id: string;
    categoryId: string;
    effectiveMonth: string;
    amountCents: number;
    createdBy: string | null;
  }[];
  goals: {
    id: string;
    name: string;
    type: string;
    note: string | null;
    position: number;
    startMonth: string;
    archivedFrom: string | null;
  }[];
  goalAmounts: {
    id: string;
    goalId: string;
    effectiveMonth: string;
    amountCents: number;
    createdBy: string | null;
  }[];
  goalCheckins: { id: string; goalId: string; month: string; checkedBy: string | null }[];
  incomeSources: {
    id: string;
    memberId: string | null;
    name: string;
    kind: "fixed" | "variable";
    startMonth: string;
    archivedFrom: string | null;
  }[];
  incomeAmounts: {
    id: string;
    sourceId: string;
    effectiveMonth: string;
    amountCents: number;
    createdBy: string | null;
  }[];
  incomeDeposits: {
    id: string;
    sourceId: string;
    receivedOn: string;
    amountCents: number;
    note: string | null;
    createdBy: string | null;
  }[];
  bills: {
    id: string;
    name: string;
    paidBy: string | null;
    note: string | null;
    addedBy: string | null;
    startMonth: string;
    archivedFrom: string | null;
  }[];
  billVersions: {
    id: string;
    billId: string;
    effectiveMonth: string;
    amountCents: number;
    intervalMonths: number;
    categoryId: string;
    createdBy: string | null;
  }[];
  expenses: {
    id: string;
    categoryId: string;
    spentOn: string;
    amountCents: number;
    description: string | null;
    addedBy: string | null;
  }[];
};

// "The Smiths" -> "the-smiths", for a friendly download filename.
function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "household";
}

export function backupFilename(householdName: string, now = new Date()): string {
  const date = now.toISOString().slice(0, 10);
  return `monies-backup-${slugify(householdName)}-${date}.json`;
}

export async function exportBackup(householdId: string): Promise<BackupFile> {
  const db = getDb();

  const [household] = await db
    .select({ id: households.id, name: households.name, currency: households.currency })
    .from(households)
    .where(eq(households.id, householdId));
  if (!household) throw new HttpError(404, "Household not found");

  const memberRows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      role: householdMembers.role,
      passwordHash: account.password,
    })
    .from(householdMembers)
    .innerJoin(user, eq(user.id, householdMembers.userId))
    .innerJoin(account, eq(account.userId, user.id))
    .where(eq(householdMembers.householdId, householdId));
  // account.password is nullable in the schema (OAuth providers have none),
  // but every member here came through insertUserWithPassword, which always
  // sets one for the "credential" provider row.
  const members = memberRows.map((m) => {
    if (!m.passwordHash) throw new Error(`Member ${m.id} has no credential password`);
    return { ...m, passwordHash: m.passwordHash };
  });

  const categoryRows = await db
    .select({
      id: categories.id,
      name: categories.name,
      position: categories.position,
      startMonth: categories.startMonth,
      archivedFrom: categories.archivedFrom,
    })
    .from(categories)
    .where(eq(categories.householdId, householdId));
  const categoryIds = categoryRows.map((c) => c.id);

  const goalRows = await db
    .select({
      id: goals.id,
      name: goals.name,
      type: goals.type,
      note: goals.note,
      position: goals.position,
      startMonth: goals.startMonth,
      archivedFrom: goals.archivedFrom,
    })
    .from(goals)
    .where(eq(goals.householdId, householdId));
  const goalIds = goalRows.map((g) => g.id);

  const incomeSourceRows = await db
    .select({
      id: incomeSources.id,
      memberId: incomeSources.memberId,
      name: incomeSources.name,
      kind: incomeSources.kind,
      startMonth: incomeSources.startMonth,
      archivedFrom: incomeSources.archivedFrom,
    })
    .from(incomeSources)
    .where(eq(incomeSources.householdId, householdId));
  const incomeSourceIds = incomeSourceRows.map((s) => s.id);

  const billRows = await db
    .select({
      id: bills.id,
      name: bills.name,
      paidBy: bills.paidBy,
      note: bills.note,
      addedBy: bills.addedBy,
      startMonth: bills.startMonth,
      archivedFrom: bills.archivedFrom,
    })
    .from(bills)
    .where(eq(bills.householdId, householdId));
  const billIds = billRows.map((b) => b.id);

  const [
    budgetAllocationRows,
    goalAmountRows,
    goalCheckinRows,
    incomeAmountRows,
    incomeDepositRows,
    billVersionRows,
    expenseRows,
  ] = await Promise.all([
    categoryIds.length
      ? db
          .select({
            id: budgetAllocations.id,
            categoryId: budgetAllocations.categoryId,
            effectiveMonth: budgetAllocations.effectiveMonth,
            amountCents: budgetAllocations.amountCents,
            createdBy: budgetAllocations.createdBy,
          })
          .from(budgetAllocations)
          .where(inArray(budgetAllocations.categoryId, categoryIds))
      : [],
    goalIds.length
      ? db
          .select({
            id: goalAmounts.id,
            goalId: goalAmounts.goalId,
            effectiveMonth: goalAmounts.effectiveMonth,
            amountCents: goalAmounts.amountCents,
            createdBy: goalAmounts.createdBy,
          })
          .from(goalAmounts)
          .where(inArray(goalAmounts.goalId, goalIds))
      : [],
    goalIds.length
      ? db
          .select({ id: goalCheckins.id, goalId: goalCheckins.goalId, month: goalCheckins.month, checkedBy: goalCheckins.checkedBy })
          .from(goalCheckins)
          .where(inArray(goalCheckins.goalId, goalIds))
      : [],
    incomeSourceIds.length
      ? db
          .select({
            id: incomeAmounts.id,
            sourceId: incomeAmounts.sourceId,
            effectiveMonth: incomeAmounts.effectiveMonth,
            amountCents: incomeAmounts.amountCents,
            createdBy: incomeAmounts.createdBy,
          })
          .from(incomeAmounts)
          .where(inArray(incomeAmounts.sourceId, incomeSourceIds))
      : [],
    incomeSourceIds.length
      ? db
          .select({
            id: incomeDeposits.id,
            sourceId: incomeDeposits.sourceId,
            receivedOn: incomeDeposits.receivedOn,
            amountCents: incomeDeposits.amountCents,
            note: incomeDeposits.note,
            createdBy: incomeDeposits.createdBy,
          })
          .from(incomeDeposits)
          .where(inArray(incomeDeposits.sourceId, incomeSourceIds))
      : [],
    billIds.length
      ? db
          .select({
            id: billVersions.id,
            billId: billVersions.billId,
            effectiveMonth: billVersions.effectiveMonth,
            amountCents: billVersions.amountCents,
            intervalMonths: billVersions.intervalMonths,
            categoryId: billVersions.categoryId,
            createdBy: billVersions.createdBy,
          })
          .from(billVersions)
          .where(inArray(billVersions.billId, billIds))
      : [],
    categoryIds.length
      ? db
          .select({
            id: expenses.id,
            categoryId: expenses.categoryId,
            spentOn: expenses.spentOn,
            amountCents: expenses.amountCents,
            description: expenses.description,
            addedBy: expenses.addedBy,
          })
          .from(expenses)
          .where(inArray(expenses.categoryId, categoryIds))
      : [],
  ]);

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: packageJson.version,
    household,
    members,
    categories: categoryRows,
    budgetAllocations: budgetAllocationRows,
    goals: goalRows,
    goalAmounts: goalAmountRows,
    goalCheckins: goalCheckinRows,
    incomeSources: incomeSourceRows,
    incomeAmounts: incomeAmountRows,
    incomeDeposits: incomeDepositRows,
    bills: billRows,
    billVersions: billVersionRows,
    expenses: expenseRows,
  };
}

// --- Restore: defensive parsing of an uploaded, untrusted file ---

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function obj(v: unknown, what: string): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    throw new HttpError(400, `${what} must be an object`);
  }
  return v as Record<string, unknown>;
}

function list(v: unknown, what: string): Record<string, unknown>[] {
  if (!Array.isArray(v)) throw new HttpError(400, `${what} must be an array`);
  return v.map((row, i) => obj(row, `${what}[${i}]`));
}

function text(v: unknown, what: string, max = 200): string {
  if (typeof v !== "string" || v.length === 0 || v.length > max) {
    throw new HttpError(400, `${what} must be a non-empty string of at most ${max} characters`);
  }
  return v;
}

function nullableText(v: unknown, what: string, max = 200): string | null {
  if (v === null || v === undefined) return null;
  return text(v, what, max);
}

function bool(v: unknown, what: string): boolean {
  if (typeof v !== "boolean") throw new HttpError(400, `${what} must be a boolean`);
  return v;
}

function integer(v: unknown, what: string): number {
  if (typeof v !== "number" || !Number.isInteger(v)) {
    throw new HttpError(400, `${what} must be an integer`);
  }
  return v;
}

function amountCents(v: unknown, what: string, min = 0): number {
  const n = integer(v, what);
  if (n < min || n > MAX_AMOUNT) {
    throw new HttpError(400, `${what} must be an integer between ${min} and ${MAX_AMOUNT}`);
  }
  return n;
}

function uuid(v: unknown, what: string): string {
  const s = text(v, what, 200);
  if (!UUID_RE.test(s)) throw new HttpError(400, `${what} must be a valid id`);
  return s;
}

function nullableRef(v: unknown, what: string, known: Set<string>): string | null {
  if (v === null || v === undefined) return null;
  const s = uuid(v, what);
  if (!known.has(s)) throw new HttpError(400, `${what} does not refer to a member in this file`);
  return s;
}

function ref(v: unknown, what: string, known: Set<string>): string {
  const s = uuid(v, what);
  if (!known.has(s)) throw new HttpError(400, `${what} does not refer to a row in this file`);
  return s;
}

function dateStr(v: unknown, what: string): string {
  try {
    return parseDate(v);
  } catch {
    throw new HttpError(400, `${what} must be a valid date in YYYY-MM-DD format`);
  }
}

function nullableDateStr(v: unknown, what: string): string | null {
  if (v === null || v === undefined) return null;
  return dateStr(v, what);
}

// Structural validation only — this is an uploaded file, not trusted input,
// even though it's expected to be an unmodified export from this same
// feature. Any problem throws one HttpError naming the offending field.
function parseFile(data: unknown): BackupFile {
  const root = obj(data, "Backup file");

  const schemaVersion = integer(root.schemaVersion, "schemaVersion");
  if (schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new HttpError(
      400,
      `This file is from a newer version of Monies (schema ${schemaVersion}); this instance understands up to ${BACKUP_SCHEMA_VERSION}.`,
    );
  }

  const householdRaw = obj(root.household, "household");
  const household = {
    id: uuid(householdRaw.id, "household.id"),
    name: text(householdRaw.name, "household.name", 100),
    currency: text(householdRaw.currency, "household.currency", 3),
  };
  if (!isValidCurrency(household.currency)) {
    throw new HttpError(400, "household.currency must be a valid ISO 4217 code");
  }

  const members = list(root.members, "members").map((m, i) => ({
    id: uuid(m.id, `members[${i}].id`),
    name: text(m.name, `members[${i}].name`, 100),
    email: text(m.email, `members[${i}].email`, 254),
    emailVerified: bool(m.emailVerified, `members[${i}].emailVerified`),
    role: parseRole(m.role),
    passwordHash: text(m.passwordHash, `members[${i}].passwordHash`, 1000),
  }));
  if (members.length === 0) throw new HttpError(400, "members must include at least one account");
  for (const m of members) {
    if (!EMAIL_RE.test(m.email)) throw new HttpError(400, `${m.email} is not a valid email address`);
  }
  const memberIds = new Set(members.map((m) => m.id));
  if (memberIds.size !== members.length) throw new HttpError(400, "members contains a duplicate id");
  if (!members.some((m) => m.role === "owner")) throw new HttpError(400, "members must include at least one owner");

  const categoryRows = list(root.categories, "categories").map((c, i) => ({
    id: uuid(c.id, `categories[${i}].id`),
    name: text(c.name, `categories[${i}].name`, 100),
    position: integer(c.position, `categories[${i}].position`),
    startMonth: dateStr(c.startMonth, `categories[${i}].startMonth`),
    archivedFrom: nullableDateStr(c.archivedFrom, `categories[${i}].archivedFrom`),
  }));
  const categoryIds = new Set(categoryRows.map((c) => c.id));

  const goalRows = list(root.goals, "goals").map((g, i) => {
    const type = text(g.type, `goals[${i}].type`, 20);
    if (!GOAL_TYPES.includes(type as GoalType)) {
      throw new HttpError(400, `goals[${i}].type must be one of: ${GOAL_TYPES.join(", ")}`);
    }
    return {
      id: uuid(g.id, `goals[${i}].id`),
      name: text(g.name, `goals[${i}].name`, 100),
      type,
      note: nullableText(g.note, `goals[${i}].note`, 200),
      position: integer(g.position, `goals[${i}].position`),
      startMonth: dateStr(g.startMonth, `goals[${i}].startMonth`),
      archivedFrom: nullableDateStr(g.archivedFrom, `goals[${i}].archivedFrom`),
    };
  });
  const goalIds = new Set(goalRows.map((g) => g.id));

  const incomeSourceRows = list(root.incomeSources, "incomeSources").map((s, i) => {
    const kind = text(s.kind, `incomeSources[${i}].kind`, 10);
    if (kind !== "fixed" && kind !== "variable") {
      throw new HttpError(400, `incomeSources[${i}].kind must be "fixed" or "variable"`);
    }
    return {
      id: uuid(s.id, `incomeSources[${i}].id`),
      memberId: nullableRef(s.memberId, `incomeSources[${i}].memberId`, memberIds),
      name: text(s.name, `incomeSources[${i}].name`, 100),
      kind: kind as "fixed" | "variable",
      startMonth: dateStr(s.startMonth, `incomeSources[${i}].startMonth`),
      archivedFrom: nullableDateStr(s.archivedFrom, `incomeSources[${i}].archivedFrom`),
    };
  });
  const incomeSourceIds = new Set(incomeSourceRows.map((s) => s.id));

  const billRows = list(root.bills, "bills").map((b, i) => ({
    id: uuid(b.id, `bills[${i}].id`),
    name: text(b.name, `bills[${i}].name`, 100),
    paidBy: nullableRef(b.paidBy, `bills[${i}].paidBy`, memberIds),
    note: nullableText(b.note, `bills[${i}].note`, 200),
    addedBy: nullableRef(b.addedBy, `bills[${i}].addedBy`, memberIds),
    startMonth: dateStr(b.startMonth, `bills[${i}].startMonth`),
    archivedFrom: nullableDateStr(b.archivedFrom, `bills[${i}].archivedFrom`),
  }));
  const billIds = new Set(billRows.map((b) => b.id));

  const budgetAllocationRows = list(root.budgetAllocations, "budgetAllocations").map((a, i) => ({
    id: uuid(a.id, `budgetAllocations[${i}].id`),
    categoryId: ref(a.categoryId, `budgetAllocations[${i}].categoryId`, categoryIds),
    effectiveMonth: dateStr(a.effectiveMonth, `budgetAllocations[${i}].effectiveMonth`),
    amountCents: amountCents(a.amountCents, `budgetAllocations[${i}].amountCents`),
    createdBy: nullableRef(a.createdBy, `budgetAllocations[${i}].createdBy`, memberIds),
  }));

  const goalAmountRows = list(root.goalAmounts, "goalAmounts").map((a, i) => ({
    id: uuid(a.id, `goalAmounts[${i}].id`),
    goalId: ref(a.goalId, `goalAmounts[${i}].goalId`, goalIds),
    effectiveMonth: dateStr(a.effectiveMonth, `goalAmounts[${i}].effectiveMonth`),
    amountCents: amountCents(a.amountCents, `goalAmounts[${i}].amountCents`),
    createdBy: nullableRef(a.createdBy, `goalAmounts[${i}].createdBy`, memberIds),
  }));

  const goalCheckinRows = list(root.goalCheckins, "goalCheckins").map((c, i) => ({
    id: uuid(c.id, `goalCheckins[${i}].id`),
    goalId: ref(c.goalId, `goalCheckins[${i}].goalId`, goalIds),
    month: dateStr(c.month, `goalCheckins[${i}].month`),
    checkedBy: nullableRef(c.checkedBy, `goalCheckins[${i}].checkedBy`, memberIds),
  }));

  const incomeAmountRows = list(root.incomeAmounts, "incomeAmounts").map((a, i) => ({
    id: uuid(a.id, `incomeAmounts[${i}].id`),
    sourceId: ref(a.sourceId, `incomeAmounts[${i}].sourceId`, incomeSourceIds),
    effectiveMonth: dateStr(a.effectiveMonth, `incomeAmounts[${i}].effectiveMonth`),
    amountCents: amountCents(a.amountCents, `incomeAmounts[${i}].amountCents`),
    createdBy: nullableRef(a.createdBy, `incomeAmounts[${i}].createdBy`, memberIds),
  }));

  const incomeDepositRows = list(root.incomeDeposits, "incomeDeposits").map((d, i) => ({
    id: uuid(d.id, `incomeDeposits[${i}].id`),
    sourceId: ref(d.sourceId, `incomeDeposits[${i}].sourceId`, incomeSourceIds),
    receivedOn: dateStr(d.receivedOn, `incomeDeposits[${i}].receivedOn`),
    amountCents: amountCents(d.amountCents, `incomeDeposits[${i}].amountCents`, 1),
    note: nullableText(d.note, `incomeDeposits[${i}].note`, 200),
    createdBy: nullableRef(d.createdBy, `incomeDeposits[${i}].createdBy`, memberIds),
  }));

  const billVersionRows = list(root.billVersions, "billVersions").map((v, i) => {
    const intervalMonths = integer(v.intervalMonths, `billVersions[${i}].intervalMonths`);
    if (![1, 3, 6, 12].includes(intervalMonths)) {
      throw new HttpError(400, `billVersions[${i}].intervalMonths must be 1, 3, 6, or 12`);
    }
    return {
      id: uuid(v.id, `billVersions[${i}].id`),
      billId: ref(v.billId, `billVersions[${i}].billId`, billIds),
      effectiveMonth: dateStr(v.effectiveMonth, `billVersions[${i}].effectiveMonth`),
      amountCents: amountCents(v.amountCents, `billVersions[${i}].amountCents`),
      intervalMonths,
      categoryId: ref(v.categoryId, `billVersions[${i}].categoryId`, categoryIds),
      createdBy: nullableRef(v.createdBy, `billVersions[${i}].createdBy`, memberIds),
    };
  });

  const expenseRows = list(root.expenses, "expenses").map((e, i) => ({
    id: uuid(e.id, `expenses[${i}].id`),
    categoryId: ref(e.categoryId, `expenses[${i}].categoryId`, categoryIds),
    spentOn: dateStr(e.spentOn, `expenses[${i}].spentOn`),
    amountCents: amountCents(e.amountCents, `expenses[${i}].amountCents`, 1),
    description: nullableText(e.description, `expenses[${i}].description`, 200),
    addedBy: nullableRef(e.addedBy, `expenses[${i}].addedBy`, memberIds),
  }));

  return {
    schemaVersion,
    exportedAt: text(root.exportedAt, "exportedAt", 40),
    appVersion: text(root.appVersion, "appVersion", 40),
    household,
    members,
    categories: categoryRows,
    budgetAllocations: budgetAllocationRows,
    goals: goalRows,
    goalAmounts: goalAmountRows,
    goalCheckins: goalCheckinRows,
    incomeSources: incomeSourceRows,
    incomeAmounts: incomeAmountRows,
    incomeDeposits: incomeDepositRows,
    bills: billRows,
    billVersions: billVersionRows,
    expenses: expenseRows,
  };
}

// wipeExisting=false is the setup-only path (targets an empty instance);
// wipeExisting=true is the live-instance overwrite (spec 044) — the caller
// (the /api/household/restore route) is responsible for the typed
// household-name confirmation before this is ever called.
export async function restoreBackup(data: unknown, opts: { wipeExisting: boolean }): Promise<void> {
  const parsed = parseFile(data);
  const db = getDb();

  try {
    await db.transaction(async (tx) => {
      const [existing] = await tx.select({ id: households.id }).from(households).limit(1);
      if (opts.wipeExisting) {
        // Deleting just `households` and relying on cascades is not safe
        // here: bill_versions.categoryId has no cascade (by design —
        // updateCategory normally blocks archiving a category with active
        // bills), and Postgres doesn't guarantee it clears bill_versions
        // before categories when both cascade from the same households
        // delete. Deleting every table explicitly, in dependency order,
        // sidesteps that ordering question entirely.
        await tx.delete(expenses);
        await tx.delete(billVersions);
        await tx.delete(bills);
        await tx.delete(goalCheckins);
        await tx.delete(goalAmounts);
        await tx.delete(goals);
        await tx.delete(incomeDeposits);
        await tx.delete(incomeAmounts);
        await tx.delete(incomeSources);
        await tx.delete(budgetAllocations);
        await tx.delete(categories);
        await tx.delete(householdMembers);
        await tx.delete(households);
        await tx.delete(user);
      } else if (existing) {
        throw new HttpError(409, "This instance is already set up");
      }

      await tx.insert(households).values({
        id: parsed.household.id,
        name: parsed.household.name,
        currency: parsed.household.currency,
      });

      for (const m of parsed.members) {
        await tx.insert(user).values({
          id: m.id,
          name: m.name,
          email: m.email,
          emailVerified: m.emailVerified,
        });
        await tx.insert(account).values({
          id: randomUUID(),
          accountId: m.id,
          providerId: "credential",
          userId: m.id,
          password: m.passwordHash,
        });
        await tx.insert(householdMembers).values({
          userId: m.id,
          householdId: parsed.household.id,
          role: m.role,
        });
      }

      if (parsed.categories.length) {
        await tx.insert(categories).values(
          parsed.categories.map((c) => ({ ...c, householdId: parsed.household.id })),
        );
      }
      if (parsed.goals.length) {
        await tx.insert(goals).values(
          parsed.goals.map((g) => ({ ...g, householdId: parsed.household.id })),
        );
      }
      if (parsed.budgetAllocations.length) {
        await tx.insert(budgetAllocations).values(parsed.budgetAllocations);
      }
      if (parsed.goalAmounts.length) await tx.insert(goalAmounts).values(parsed.goalAmounts);
      if (parsed.goalCheckins.length) await tx.insert(goalCheckins).values(parsed.goalCheckins);
      if (parsed.incomeSources.length) {
        await tx.insert(incomeSources).values(
          parsed.incomeSources.map((s) => ({ ...s, householdId: parsed.household.id })),
        );
      }
      if (parsed.incomeAmounts.length) await tx.insert(incomeAmounts).values(parsed.incomeAmounts);
      if (parsed.incomeDeposits.length) await tx.insert(incomeDeposits).values(parsed.incomeDeposits);
      if (parsed.bills.length) {
        await tx.insert(bills).values(
          parsed.bills.map((b) => ({ ...b, householdId: parsed.household.id })),
        );
      }
      if (parsed.billVersions.length) await tx.insert(billVersions).values(parsed.billVersions);
      if (parsed.expenses.length) await tx.insert(expenses).values(parsed.expenses);
    });
  } catch (e) {
    if (e instanceof HttpError) throw e;
    if (isUniqueViolation(e)) {
      throw new HttpError(400, "Backup file contains conflicting or duplicate rows");
    }
    throw e;
  }
}
