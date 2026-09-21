import { getDb } from "@/db";
import { householdMembers, households } from "@/db/schema";
import { insertUserWithPassword } from "./accounts";
import { insertStarterCategories } from "./categories";
import { HttpError, isUniqueViolation } from "./http";

// First run: no household exists yet.
export async function isSetupNeeded(): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: households.id })
    .from(households)
    .limit(1);
  return !row;
}

export async function runSetup(input: {
  householdName: string;
  currency: string;
  name: string;
  email: string;
  password: string;
}) {
  const alreadyDone = new HttpError(409, "This instance is already set up");
  try {
    await getDb().transaction(async (tx) => {
      // The unique `singleton` column makes a concurrent second setup fail here.
      const [household] = await tx
        .insert(households)
        .values({ name: input.householdName, currency: input.currency })
        .returning({ id: households.id });
      await insertStarterCategories(tx, household.id);
      const userId = await insertUserWithPassword(tx, input);
      await tx
        .insert(householdMembers)
        .values({ userId, householdId: household.id, role: "owner" });
    });
  } catch (e) {
    // A unique violation on the household insert means setup already ran; on
    // the user insert insertUserWithPassword already threw its own HttpError.
    if (!(e instanceof HttpError) && isUniqueViolation(e)) throw alreadyDone;
    throw e;
  }
}
