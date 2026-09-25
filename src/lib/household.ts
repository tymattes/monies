import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { householdMembers, households } from "@/db/schema";
import { getAuth } from "./auth";
import { HttpError } from "./http";

export type Role = "owner" | "member";
export const ROLES: Role[] = ["owner", "member"];

export type HouseholdContext = {
  user: { id: string; name: string; email: string };
  household: { id: string; name: string; currency: string };
  role: Role;
};

// Resolves the signed-in user's household, or null if signed out / not a member.
export async function getHouseholdContext(
  headers: Headers,
): Promise<HouseholdContext | null> {
  const session = await getAuth().api.getSession({ headers });
  if (!session) return null;
  const [row] = await getDb()
    .select({
      householdId: households.id,
      householdName: households.name,
      householdCurrency: households.currency,
      role: householdMembers.role,
    })
    .from(householdMembers)
    .innerJoin(households, eq(households.id, householdMembers.householdId))
    .where(eq(householdMembers.userId, session.user.id))
    .limit(1);
  if (!row) return null;
  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    },
    household: {
      id: row.householdId,
      name: row.householdName,
      currency: row.householdCurrency,
    },
    role: row.role,
  };
}

// Every household-scoped route handler calls this first: it is the single
// place that enforces "signed in and a member of the household".
export async function requireHousehold(
  headers: Headers,
  { role }: { role?: Role } = {},
): Promise<HouseholdContext> {
  const session = await getAuth().api.getSession({ headers });
  if (!session) throw new HttpError(401, "Sign in required");
  const ctx = await getHouseholdContext(headers);
  if (!ctx) throw new HttpError(403, "Not a member of this household");
  if (role === "owner" && ctx.role !== "owner") {
    throw new HttpError(403, "Only owners can do this");
  }
  return ctx;
}
