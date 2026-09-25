import { and, count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { householdMembers, user } from "@/db/schema";
import type { HouseholdContext, Role } from "./household";
import { HttpError } from "./http";

export async function listMembers(householdId: string) {
  return getDb()
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: householdMembers.role,
      joinedAt: householdMembers.joinedAt,
    })
    .from(householdMembers)
    .innerJoin(user, eq(user.id, householdMembers.userId))
    .where(eq(householdMembers.householdId, householdId))
    .orderBy(householdMembers.joinedAt);
}

// Owners can remove anyone; anyone can remove themselves (leave). The last
// owner can never be removed. Deleting the user cascades to their sessions,
// credentials and membership, so their session stops working immediately.
export async function removeMember(ctx: HouseholdContext, targetUserId: string) {
  const isSelf = targetUserId === ctx.user.id;
  if (!isSelf && ctx.role !== "owner") {
    throw new HttpError(403, "Only owners can remove other members");
  }
  await getDb().transaction(async (tx) => {
    const [target] = await tx
      .select({ role: householdMembers.role })
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.userId, targetUserId),
          eq(householdMembers.householdId, ctx.household.id),
        ),
      )
      .for("update");
    if (!target) throw new HttpError(404, "Member not found");
    if (target.role === "owner") {
      const [{ owners }] = await tx
        .select({ owners: count() })
        .from(householdMembers)
        .where(
          and(
            eq(householdMembers.householdId, ctx.household.id),
            eq(householdMembers.role, "owner"),
          ),
        );
      if (owners <= 1) {
        throw new HttpError(409, "The last owner cannot be removed or leave");
      }
    }
    await tx.delete(user).where(eq(user.id, targetUserId));
  });
}

// Any owner can promote a member to owner or demote an owner back to
// member — including themselves (spec 041: a household can have more than
// one owner, with full parity, so there's no separate "admin" tier to
// learn about). The only rule is the same one removeMember already
// enforces for leaving/removal: the last owner can never lose the role.
export async function updateMemberRole(
  ctx: HouseholdContext,
  targetUserId: string,
  role: Role,
) {
  await getDb().transaction(async (tx) => {
    const [target] = await tx
      .select({ role: householdMembers.role })
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.userId, targetUserId),
          eq(householdMembers.householdId, ctx.household.id),
        ),
      )
      .for("update");
    if (!target) throw new HttpError(404, "Member not found");

    if (target.role === "owner" && role === "member") {
      const [{ owners }] = await tx
        .select({ owners: count() })
        .from(householdMembers)
        .where(
          and(
            eq(householdMembers.householdId, ctx.household.id),
            eq(householdMembers.role, "owner"),
          ),
        );
      if (owners <= 1) {
        throw new HttpError(409, "The last owner cannot be demoted");
      }
    }

    await tx
      .update(householdMembers)
      .set({ role })
      .where(eq(householdMembers.userId, targetUserId));
  });
}
