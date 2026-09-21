import { and, asc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  householdMembers,
  incomeAmounts,
  incomeDeposits,
  incomeSources,
  user,
} from "@/db/schema";
import type { HouseholdContext } from "./household";
import { HttpError, isUniqueViolation } from "./http";
import { addMonths, currentMonth, monthStart } from "./months";

export type SourceKind = "fixed" | "variable";

const NAME_TAKEN = "You already have an income source with this name";

type Source = typeof incomeSources.$inferSelect;

// A source shows in month M when start_month <= M < archived_from (if any).
const visibleIn = (month: string) =>
  and(
    lte(incomeSources.startMonth, monthStart(month)),
    sql`(${incomeSources.archivedFrom} is null or ${monthStart(month)} < ${incomeSources.archivedFrom})`,
  );

function activeIn(source: Source, month: string) {
  const start = monthStart(month);
  return (
    source.startMonth <= start &&
    (source.archivedFrom === null || start < source.archivedFrom)
  );
}

// Owners can edit anyone's income; members only their own. Sources whose
// member was removed (member_id null) are owner-only.
function assertCanEdit(ctx: HouseholdContext, source: Source) {
  if (ctx.role === "owner" || source.memberId === ctx.user.id) return;
  throw new HttpError(403, "You can only change your own income");
}

async function loadSource(ctx: HouseholdContext, id: string): Promise<Source> {
  const [source] = await getDb()
    .select()
    .from(incomeSources)
    .where(
      and(
        eq(incomeSources.id, id),
        eq(incomeSources.householdId, ctx.household.id),
      ),
    );
  if (!source) throw new HttpError(404, "Income source not found");
  return source;
}

export async function listSources(ctx: HouseholdContext) {
  return getDb()
    .select({
      id: incomeSources.id,
      memberId: incomeSources.memberId,
      name: incomeSources.name,
      kind: incomeSources.kind,
      startMonth: incomeSources.startMonth,
      archivedFrom: incomeSources.archivedFrom,
    })
    .from(incomeSources)
    .where(eq(incomeSources.householdId, ctx.household.id))
    .orderBy(asc(incomeSources.createdAt));
}

export async function createSource(
  ctx: HouseholdContext,
  input: { name: string; kind: SourceKind; memberId?: string },
) {
  const memberId = input.memberId ?? ctx.user.id;
  if (memberId !== ctx.user.id && ctx.role !== "owner") {
    throw new HttpError(403, "You can only add income for yourself");
  }
  const [member] = await getDb()
    .select({ userId: householdMembers.userId })
    .from(householdMembers)
    .where(
      and(
        eq(householdMembers.userId, memberId),
        eq(householdMembers.householdId, ctx.household.id),
      ),
    );
  if (!member) throw new HttpError(404, "Member not found");

  try {
    const [row] = await getDb()
      .insert(incomeSources)
      .values({
        householdId: ctx.household.id,
        memberId,
        name: input.name,
        kind: input.kind,
        startMonth: monthStart(currentMonth()),
      })
      .returning();
    return row;
  } catch (e) {
    if (isUniqueViolation(e)) throw new HttpError(409, NAME_TAKEN);
    throw e;
  }
}

export async function updateSource(
  ctx: HouseholdContext,
  id: string,
  patch: { name?: string; archived?: boolean },
) {
  const source = await loadSource(ctx, id);
  assertCanEdit(ctx, source);
  const set: Partial<typeof incomeSources.$inferInsert> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.archived === true && source.archivedFrom === null) {
    set.archivedFrom = monthStart(currentMonth());
  }
  if (patch.archived === false) set.archivedFrom = null;
  if (Object.keys(set).length === 0) return;
  try {
    await getDb().update(incomeSources).set(set).where(eq(incomeSources.id, id));
  } catch (e) {
    if (isUniqueViolation(e)) throw new HttpError(409, NAME_TAKEN);
    throw e;
  }
}

// Sets a fixed source's monthly amount from `month` onward (current or future).
export async function setFixedAmount(
  ctx: HouseholdContext,
  month: string,
  sourceId: string,
  amountCents: number,
) {
  if (month < currentMonth()) {
    throw new HttpError(400, "Past months are read-only");
  }
  const source = await loadSource(ctx, sourceId);
  assertCanEdit(ctx, source);
  if (source.kind !== "fixed") {
    throw new HttpError(400, "Only fixed sources have a monthly amount");
  }
  if (!activeIn(source, month)) {
    throw new HttpError(404, "Income source not found for this month");
  }
  await getDb()
    .insert(incomeAmounts)
    .values({
      sourceId,
      effectiveMonth: monthStart(month),
      amountCents,
      createdBy: ctx.user.id,
    })
    .onConflictDoUpdate({
      target: [incomeAmounts.sourceId, incomeAmounts.effectiveMonth],
      set: { amountCents, createdBy: ctx.user.id },
    });
}

function assertDepositAllowed(source: Source, receivedOn: string) {
  if (source.kind !== "variable") {
    throw new HttpError(400, "Deposits can only be added to variable sources");
  }
  if (!activeIn(source, receivedOn.slice(0, 7))) {
    throw new HttpError(400, "This source is not active in that month");
  }
}

export async function addDeposit(
  ctx: HouseholdContext,
  sourceId: string,
  input: { receivedOn: string; amountCents: number; note: string | null },
) {
  const source = await loadSource(ctx, sourceId);
  assertCanEdit(ctx, source);
  assertDepositAllowed(source, input.receivedOn);
  const [row] = await getDb()
    .insert(incomeDeposits)
    .values({ sourceId, ...input, createdBy: ctx.user.id })
    .returning();
  return row;
}

async function loadDeposit(ctx: HouseholdContext, id: string) {
  const [row] = await getDb()
    .select({ deposit: incomeDeposits, source: incomeSources })
    .from(incomeDeposits)
    .innerJoin(incomeSources, eq(incomeSources.id, incomeDeposits.sourceId))
    .where(
      and(
        eq(incomeDeposits.id, id),
        eq(incomeSources.householdId, ctx.household.id),
      ),
    );
  if (!row) throw new HttpError(404, "Deposit not found");
  assertCanEdit(ctx, row.source);
  return row;
}

export async function updateDeposit(
  ctx: HouseholdContext,
  id: string,
  patch: { receivedOn?: string; amountCents?: number; note?: string | null },
) {
  const { source } = await loadDeposit(ctx, id);
  if (patch.receivedOn !== undefined) {
    assertDepositAllowed(source, patch.receivedOn);
  }
  await getDb().update(incomeDeposits).set(patch).where(eq(incomeDeposits.id, id));
}

export async function deleteDeposit(ctx: HouseholdContext, id: string) {
  await loadDeposit(ctx, id);
  await getDb().delete(incomeDeposits).where(eq(incomeDeposits.id, id));
}

export type IncomeSourceView = {
  id: string;
  name: string;
  kind: SourceKind;
  amountCents: number;
  canEdit: boolean;
  deposits: {
    id: string;
    receivedOn: string;
    amountCents: number;
    note: string | null;
  }[];
};

export type IncomeMemberView = {
  memberId: string | null;
  name: string;
  isSelf: boolean;
  canAdd: boolean;
  totalCents: number;
  sources: IncomeSourceView[];
};

export type IncomeMonth = {
  month: string;
  currency: string;
  editable: boolean;
  members: IncomeMemberView[];
  totalCents: number;
};

// Fixed sources use the latest amount on or before the month (0 if none);
// variable sources sum the deposits dated within the month.
export async function getIncomeMonth(
  ctx: HouseholdContext,
  month: string,
): Promise<IncomeMonth> {
  const db = getDb();
  const [members, sources] = await Promise.all([
    db
      .select({ id: user.id, name: user.name })
      .from(householdMembers)
      .innerJoin(user, eq(user.id, householdMembers.userId))
      .where(eq(householdMembers.householdId, ctx.household.id))
      .orderBy(asc(householdMembers.joinedAt)),
    db
      .select({
        id: incomeSources.id,
        memberId: incomeSources.memberId,
        name: incomeSources.name,
        kind: incomeSources.kind,
        fixedCents: sql<number>`coalesce((
          select a.amount_cents from ${incomeAmounts} a
          where a.source_id = "income_sources"."id"
            and a.effective_month <= ${monthStart(month)}
          order by a.effective_month desc limit 1
        ), 0)`.mapWith(Number),
      })
      .from(incomeSources)
      .where(
        and(eq(incomeSources.householdId, ctx.household.id), visibleIn(month)),
      )
      .orderBy(asc(incomeSources.createdAt)),
  ]);

  const variableIds = sources.filter((s) => s.kind === "variable").map((s) => s.id);
  const deposits = variableIds.length
    ? await db
        .select({
          id: incomeDeposits.id,
          sourceId: incomeDeposits.sourceId,
          receivedOn: incomeDeposits.receivedOn,
          amountCents: incomeDeposits.amountCents,
          note: incomeDeposits.note,
        })
        .from(incomeDeposits)
        .where(
          and(
            inArray(incomeDeposits.sourceId, variableIds),
            gte(incomeDeposits.receivedOn, monthStart(month)),
            lt(incomeDeposits.receivedOn, monthStart(addMonths(month, 1))),
          ),
        )
        .orderBy(asc(incomeDeposits.receivedOn), asc(incomeDeposits.createdAt))
    : [];

  const isOwner = ctx.role === "owner";
  const viewOf = (s: (typeof sources)[number]): IncomeSourceView => {
    const own = deposits.filter((d) => d.sourceId === s.id);
    return {
      id: s.id,
      name: s.name,
      kind: s.kind,
      amountCents:
        s.kind === "fixed"
          ? s.fixedCents
          : own.reduce((sum, d) => sum + d.amountCents, 0),
      canEdit: isOwner || s.memberId === ctx.user.id,
      deposits: own.map((d) => ({
        id: d.id,
        receivedOn: d.receivedOn,
        amountCents: d.amountCents,
        note: d.note,
      })),
    };
  };

  const groups: IncomeMemberView[] = members.map((m) => {
    const views = sources.filter((s) => s.memberId === m.id).map(viewOf);
    return {
      memberId: m.id,
      name: m.name,
      isSelf: m.id === ctx.user.id,
      canAdd: isOwner || m.id === ctx.user.id,
      totalCents: views.reduce((sum, v) => sum + v.amountCents, 0),
      sources: views,
    };
  });

  const orphaned = sources.filter((s) => s.memberId === null).map(viewOf);
  if (orphaned.length > 0) {
    groups.push({
      memberId: null,
      name: "Former member",
      isSelf: false,
      canAdd: false,
      totalCents: orphaned.reduce((sum, v) => sum + v.amountCents, 0),
      sources: orphaned,
    });
  }

  return {
    month,
    currency: ctx.household.currency,
    editable: month >= currentMonth(),
    members: groups,
    totalCents: groups.reduce((sum, g) => sum + g.totalCents, 0),
  };
}
