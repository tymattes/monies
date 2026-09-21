import { requireHousehold } from "@/lib/household";
import { createInvite, listPendingInvites } from "@/lib/invites";
import { route } from "@/lib/http";

export const GET = route(async (request) => {
  const ctx = await requireHousehold(request.headers, { role: "owner" });
  return Response.json({ invites: await listPendingInvites(ctx.household.id) });
});

// The returned token/path is the only time the link is available.
export const POST = route(async (request) => {
  const ctx = await requireHousehold(request.headers, { role: "owner" });
  return Response.json(await createInvite(ctx), { status: 201 });
});
