import { backupFilename, exportBackup } from "@/lib/backup";
import { requireHousehold } from "@/lib/household";
import { route } from "@/lib/http";

// Owner-only: the file includes every member's password hash (spec 044).
export const GET = route(async (request) => {
  const ctx = await requireHousehold(request.headers, { role: "owner" });
  const backup = await exportBackup(ctx.household.id);
  return new Response(JSON.stringify(backup, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="${backupFilename(ctx.household.name)}"`,
    },
  });
});
