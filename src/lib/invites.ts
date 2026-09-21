import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { householdMembers, households, invites } from "@/db/schema";
import { insertUserWithPassword } from "./accounts";
import type { HouseholdContext } from "./household";
import { HttpError } from "./http";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export type InviteStatus = "valid" | "invalid" | "used" | "revoked" | "expired";

export const INVITE_MESSAGES: Record<Exclude<InviteStatus, "valid">, string> = {
  invalid: "This invite link is not valid.",
  used: "This invite link has already been used.",
  revoked: "This invite link was revoked.",
  expired: "This invite link has expired.",
};

function statusOf(
  invite:
    | { usedAt: Date | null; revokedAt: Date | null; expiresAt: Date }
    | undefined,
): InviteStatus {
  if (!invite) return "invalid";
  if (invite.usedAt) return "used";
  if (invite.revokedAt) return "revoked";
  if (invite.expiresAt <= new Date()) return "expired";
  return "valid";
}

// The token is returned once here and never stored, only its hash.
export async function createInvite(ctx: HouseholdContext) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const [row] = await getDb()
    .insert(invites)
    .values({
      householdId: ctx.household.id,
      tokenHash: hashToken(token),
      createdBy: ctx.user.id,
      expiresAt,
    })
    .returning({ id: invites.id });
  return { id: row.id, token, path: `/join/${token}`, expiresAt };
}

export async function listPendingInvites(householdId: string) {
  return getDb()
    .select({
      id: invites.id,
      createdAt: invites.createdAt,
      expiresAt: invites.expiresAt,
    })
    .from(invites)
    .where(
      and(
        eq(invites.householdId, householdId),
        isNull(invites.usedAt),
        isNull(invites.revokedAt),
        gt(invites.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(invites.createdAt));
}

export async function revokeInvite(householdId: string, inviteId: string) {
  const revoked = await getDb()
    .update(invites)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(invites.id, inviteId),
        eq(invites.householdId, householdId),
        isNull(invites.usedAt),
        isNull(invites.revokedAt),
      ),
    )
    .returning({ id: invites.id });
  if (revoked.length === 0) throw new HttpError(404, "Invite not found");
}

export async function lookupInvite(token: string) {
  const [row] = await getDb()
    .select({
      usedAt: invites.usedAt,
      revokedAt: invites.revokedAt,
      expiresAt: invites.expiresAt,
      householdName: households.name,
    })
    .from(invites)
    .innerJoin(households, eq(households.id, invites.householdId))
    .where(eq(invites.tokenHash, hashToken(token)))
    .limit(1);
  const status = statusOf(row);
  return { status, householdName: row?.householdName ?? null };
}

export async function acceptInvite(
  token: string,
  input: { name: string; email: string; password: string },
) {
  await getDb().transaction(async (tx) => {
    // Lock the row so two people cannot redeem the same single-use link.
    const [invite] = await tx
      .select()
      .from(invites)
      .where(eq(invites.tokenHash, hashToken(token)))
      .for("update");
    const status = statusOf(invite);
    if (status !== "valid") {
      throw new HttpError(410, INVITE_MESSAGES[status as keyof typeof INVITE_MESSAGES]);
    }
    const userId = await insertUserWithPassword(tx, input);
    await tx.insert(householdMembers).values({
      userId,
      householdId: invite.householdId,
      role: "member",
    });
    await tx
      .update(invites)
      .set({ usedAt: new Date(), usedBy: userId })
      .where(eq(invites.id, invite.id));
  });
}
