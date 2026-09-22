import { and, asc, eq, isNull, max } from "drizzle-orm";
import { getDb } from "@/db";
import { categories } from "@/db/schema";
import type { Tx } from "./accounts";
import { countBillsBlockingCategory } from "./bills";
import type { HouseholdContext } from "./household";
import { HttpError, isUniqueViolation } from "./http";
import { currentMonth, monthStart } from "./months";

// Expense categories only (spec 014: Saving and Debt payoff moved to their
// own `goals`, since that money is unobservable to this app — see
// src/lib/goals.ts).
export const STARTER_CATEGORIES = [
  "Housing",
  "Groceries",
  "Dining out",
  "Transport",
  "Utilities",
  "Health",
  "Entertainment",
  "Other",
];

export async function insertStarterCategories(tx: Tx, householdId: string) {
  const start = monthStart(currentMonth());
  await tx.insert(categories).values(
    STARTER_CATEGORIES.map((name, position) => ({
      householdId,
      name,
      position,
      startMonth: start,
    })),
  );
}

const NAME_TAKEN = "A category with this name already exists";

export async function listCategories(householdId: string) {
  return getDb()
    .select({
      id: categories.id,
      name: categories.name,
      position: categories.position,
      startMonth: categories.startMonth,
      archivedFrom: categories.archivedFrom,
    })
    .from(categories)
    .where(eq(categories.householdId, householdId))
    .orderBy(asc(categories.position), asc(categories.name));
}

export async function createCategory(ctx: HouseholdContext, name: string) {
  try {
    return await getDb().transaction(async (tx) => {
      const [{ top }] = await tx
        .select({ top: max(categories.position) })
        .from(categories)
        .where(eq(categories.householdId, ctx.household.id));
      const [row] = await tx
        .insert(categories)
        .values({
          householdId: ctx.household.id,
          name,
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

export type CategoryPatch = {
  name?: string;
  archived?: boolean;
  position?: number;
};

export async function updateCategory(
  ctx: HouseholdContext,
  id: string,
  patch: CategoryPatch,
) {
  try {
    await getDb().transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(categories)
        .where(
          and(
            eq(categories.id, id),
            eq(categories.householdId, ctx.household.id),
          ),
        )
        .for("update");
      if (!existing) throw new HttpError(404, "Category not found");

      const set: Partial<typeof categories.$inferInsert> = {};
      if (patch.name !== undefined) set.name = patch.name;
      if (patch.archived === true && existing.archivedFrom === null) {
        const blocking = await countBillsBlockingCategory(
          ctx.household.id,
          id,
        );
        if (blocking > 0) {
          throw new HttpError(
            409,
            `This category has ${blocking} active bill${blocking === 1 ? "" : "s"}. Move or end ${blocking === 1 ? "it" : "them"} first.`,
          );
        }
        set.archivedFrom = monthStart(currentMonth());
      }
      if (patch.archived === false) set.archivedFrom = null;
      if (Object.keys(set).length > 0) {
        await tx.update(categories).set(set).where(eq(categories.id, id));
      }

      if (patch.position !== undefined) {
        // Move within the active categories, then renumber them 0..n-1.
        const active = await tx
          .select({ id: categories.id })
          .from(categories)
          .where(
            and(
              eq(categories.householdId, ctx.household.id),
              isNull(categories.archivedFrom),
            ),
          )
          .orderBy(asc(categories.position), asc(categories.name));
        const ids = active.map((c) => c.id).filter((x) => x !== id);
        if (active.some((c) => c.id === id)) {
          ids.splice(Math.min(patch.position, ids.length), 0, id);
          for (const [position, categoryId] of ids.entries()) {
            await tx
              .update(categories)
              .set({ position })
              .where(eq(categories.id, categoryId));
          }
        }
      }
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new HttpError(409, NAME_TAKEN);
    throw e;
  }
}
