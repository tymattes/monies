import { restoreBackup } from "@/lib/backup";
import { requireHousehold } from "@/lib/household";
import { HttpError, readJson, route } from "@/lib/http";

// Owner-only, live instance: replaces everything currently in this household
// with what's in the uploaded file (spec 044). The typed confirmation is
// checked before the transaction even opens, so a wrong confirmation never
// touches the database.
export const POST = route(async (request) => {
  const ctx = await requireHousehold(request.headers, { role: "owner" });
  const body = await readJson(request);
  if (body.confirmHouseholdName !== ctx.household.name) {
    throw new HttpError(400, "Type the household name to confirm");
  }
  await restoreBackup(body.backup, { wipeExisting: true });
  return Response.json({ ok: true }, { status: 200 });
});
