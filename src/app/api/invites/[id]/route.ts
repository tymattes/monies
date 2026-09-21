import { requireHousehold } from "@/lib/household";
import { HttpError, route } from "@/lib/http";
import { revokeInvite } from "@/lib/invites";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const DELETE = route(
  async (request, ctx: RouteContext<"/api/invites/[id]">) => {
    const me = await requireHousehold(request.headers, { role: "owner" });
    const { id } = await ctx.params;
    if (!UUID.test(id)) throw new HttpError(404, "Invite not found");
    await revokeInvite(me.household.id, id);
    return new Response(null, { status: 204 });
  },
);
