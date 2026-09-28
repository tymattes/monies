import { restoreBackup } from "@/lib/backup";
import { HttpError, readJson, route } from "@/lib/http";
import { isSetupNeeded } from "@/lib/setup";

// First-run only, like /api/setup: restores a backup onto an empty instance.
// No session cookie is issued — a restore can bring back several members,
// so there's no single obvious "the user who just did this" to sign in.
export const POST = route(async (request) => {
  if (!(await isSetupNeeded())) {
    throw new HttpError(409, "This instance is already set up");
  }
  const body = await readJson(request);
  await restoreBackup(body, { wipeExisting: false });
  return Response.json({ ok: true }, { status: 201 });
});
