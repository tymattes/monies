import { requireHousehold } from "@/lib/household";
import { route } from "@/lib/http";
import { listMembers } from "@/lib/members";

export const GET = route(async (request) => {
  const ctx = await requireHousehold(request.headers);
  return Response.json({ members: await listMembers(ctx.household.id) });
});
