import { and, asc, eq, isNull, max, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { goalAmounts, goalCheckins, goals } from "@/db/schema";
import type { Tx } from "./accounts";
import type { GoalType } from "./goalTypes";
import type { HouseholdContext } from "./household";
import { HttpError, isUniqueViolation } from "./http";
import { currentMonth, monthStart } from "./months";

export type { GoalType } from "./goalTypes";

// A new household starts with one Saving goal, the same out-of-the-box feel
// spec 004 gave starter categories (spec 014: it used to be a category).
export async function insertStarterGoals(tx: Tx, householdId: string) {
  const start = monthStart(currentMonth());
  await tx.insert(goals).values({
    householdId,
    name: "Savings",
    type: "saving",
    position: 0,
    startMonth: start,
  });
}

const NAME_TAKEN = "A goal with this name already exists";

export async function listGoals(householdId: string) {
  return getDb()
    .select({
      id: goals.id,
      name: goals.name,
      type: sql<GoalType>`${goals.type}`,
      note: goals.note,
      position: goals.position,
      startMonth: goals.startMonth,
      archivedFrom: goals.archivedFrom,
    })
    .from(goals)
    .where(eq(goals.householdId, householdId))
    .orderBy(asc(goals.position), asc(goals.name));
}

export async function createGoal(
  ctx: HouseholdContext,
  name: string,
  type: GoalType,
) {
  try {
    return await getDb().transaction(async (tx) => {
      const [{ top }] = await tx
        .select({ top: max(goals.position) })
        .from(goals)
        .where(eq(goals.householdId, ctx.household.id));
      const [row] = await tx
        .insert(goals)
        .values({
          householdId: ctx.household.id,
          name,
          type,
          position: (top ?? -1) + 1,
          startMonth: monthStart(currentMonth()),
        })
        .returning();
      return row;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new HttpError(409, NAME_TAKEN);
    throw e;
  }
}

export type GoalPatch = {
  name?: string;
  type?: GoalType;
  // undefined = leave unchanged, null = clear, string = set (parseLabel's
  // three-way semantics, same as bills' note).
  note?: string | null;
  archived?: boolean;
  position?: number;
};

export async function updateGoal(
  ctx: HouseholdContext,
  id: string,
  patch: GoalPatch,
) {
  try {
    await getDb().transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(goals)
        .where(and(eq(goals.id, id), eq(goals.householdId, ctx.household.id)))
        .for("update");
      if (!existing) throw new HttpError(404, "Goal not found");

      const set: Partial<typeof goals.$inferInsert> = {};
      if (patch.name !== undefined) set.name = patch.name;
      if (patch.type !== undefined) set.type = patch.type;
      if (patch.note !== undefined) set.note = patch.note;
      if (patch.archived === true && existing.archivedFrom === null) {
        set.archivedFrom = monthStart(currentMonth());
      }
      if (patch.archived === false) set.archivedFrom = null;
      if (Object.keys(set).length > 0) {
        await tx.update(goals).set(set).where(eq(goals.id, id));
      }

      if (patch.position !== undefined) {
        // Move within the active goals, then renumber them 0..n-1.
        const active = await tx
          .select({ id: goals.id })
          .from(goals)
          .where(
            and(
              eq(goals.householdId, ctx.household.id),
              isNull(goals.archivedFrom),
            ),
          )
          .orderBy(asc(goals.position), asc(goals.name));
        const ids = active.map((g) => g.id).filter((x) => x !== id);
        if (active.some((g) => g.id === id)) {
          ids.splice(Math.min(patch.position, ids.length), 0, id);
          for (const [position, goalId] of ids.entries()) {
            await tx.update(goals).set({ position }).where(eq(goals.id, goalId));
          }
        }
      }
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new HttpError(409, NAME_TAKEN);
    throw e;
  }
}

export type GoalLine = {
  id: string;
  name: string;
  type: GoalType;
  note: string | null;
  amountCents: number;
  // Whether the goal was checked off for this month (spec 014). Unlike
  // amountCents, this is not time-versioned "latest so far" — it is exactly
  // this month or nothing.
  checked: boolean;
};

export type GoalsMonth = {
  month: string;
  editable: boolean;
  goals: GoalLine[];
  totalCents: number;
  savingCents: number;
  debtPayoffCents: number;
};

// A goal shows in month M when start_month <= M < archived_from (if any).
const visibleIn = (month: string) =>
  and(
    sql`${goals.startMonth} <= ${monthStart(month)}`,
    sql`(${goals.archivedFrom} is null or ${monthStart(month)} < ${goals.archivedFrom})`,
  );

// The amount for a month is the goal_amounts row with the latest
// effective_month on or before it (0 if none), same rule as budget
// allocations, so later months inherit earlier amounts until changed.
export async function getGoalsMonth(
  ctx: HouseholdContext,
  month: string,
): Promise<GoalsMonth> {
  const rows = await getDb()
    .select({
      id: goals.id,
      name: goals.name,
      type: sql<GoalType>`${goals.type}`,
      note: goals.note,
      amountCents: sql<number>`coalesce((
        select a.amount_cents from ${goalAmounts} a
        where a.goal_id = "goals"."id"
          and a.effective_month <= ${monthStart(month)}
        order by a.effective_month desc limit 1
      ), 0)`.mapWith(Number),
      checked: sql<boolean>`exists (
        select 1 from ${goalCheckins} c
        where c.goal_id = "goals"."id" and c.month = ${monthStart(month)}
      )`,
    })
    .from(goals)
    .where(and(eq(goals.householdId, ctx.household.id), visibleIn(month)))
    .orderBy(asc(goals.position), asc(goals.name));

  const sum = (type: GoalType) =>
    rows.filter((r) => r.type === type).reduce((t, r) => t + r.amountCents, 0);

  return {
    month,
    editable: month >= currentMonth(),
    goals: rows,
    totalCents: rows.reduce((t, r) => t + r.amountCents, 0),
    savingCents: sum("saving"),
    debtPayoffCents: sum("debt payoff"),
  };
}

// Writes a goal's amount effective from `month` onward. Past months are
// read-only so history can never be rewritten — same rule as a budget
// allocation.
export async function setGoalAmount(
  ctx: HouseholdContext,
  month: string,
  goalId: string,
  amountCents: number,
) {
  if (month < currentMonth()) {
    throw new HttpError(400, "Past months are read-only");
  }
  const [goal] = await getDb()
    .select({ id: goals.id })
    .from(goals)
    .where(
      and(
        eq(goals.id, goalId),
        eq(goals.householdId, ctx.household.id),
        visibleIn(month),
      ),
    );
  if (!goal) throw new HttpError(404, "Goal not found for this month");

  await getDb()
    .insert(goalAmounts)
    .values({
      goalId,
      effectiveMonth: monthStart(month),
      amountCents,
      createdBy: ctx.user.id,
    })
    .onConflictDoUpdate({
      target: [goalAmounts.goalId, goalAmounts.effectiveMonth],
      set: { amountCents, createdBy: ctx.user.id },
    });
}

// Checks or unchecks a goal for a month. Unlike the amount, this has no
// read-only-past rule: a checkmark records a fact ("I made the transfer"),
// often confirmed after the month closes, not a plan being rewritten.
export async function setGoalCheckin(
  ctx: HouseholdContext,
  month: string,
  goalId: string,
  checked: boolean,
) {
  const [goal] = await getDb()
    .select({ id: goals.id })
    .from(goals)
    .where(
      and(
        eq(goals.id, goalId),
        eq(goals.householdId, ctx.household.id),
        visibleIn(month),
      ),
    );
  if (!goal) throw new HttpError(404, "Goal not found for this month");

  if (checked) {
    await getDb()
      .insert(goalCheckins)
      .values({ goalId, month: monthStart(month), checkedBy: ctx.user.id })
      .onConflictDoUpdate({
        target: [goalCheckins.goalId, goalCheckins.month],
        set: { checkedBy: ctx.user.id, checkedAt: new Date() },
      });
  } else {
    await getDb()
      .delete(goalCheckins)
      .where(
        and(
          eq(goalCheckins.goalId, goalId),
          eq(goalCheckins.month, monthStart(month)),
        ),
      );
  }
}
