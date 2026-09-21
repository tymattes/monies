import { requireHousehold } from "@/lib/household";
import { route } from "@/lib/http";
import { removeMember } from "@/lib/members";

// Owners remove any member; a member can remove themselves (leave).
export const DELETE = route(
  async (request, ctx: RouteContext<"/api/members/[userId]">) => {
    const me = await requireHousehold(request.headers);
    const { userId } = await ctx.params;
    await removeMember(me, userId);
    return new Response(null, { status: 204 });
  },
);
