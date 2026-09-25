import { requireHousehold } from "@/lib/household";
import { readJson, route } from "@/lib/http";
import { removeMember, updateMemberRole } from "@/lib/members";
import { parseRole } from "@/lib/validate";

// Owners remove any member; a member can remove themselves (leave).
export const DELETE = route(
  async (request, ctx: RouteContext<"/api/members/[userId]">) => {
    const me = await requireHousehold(request.headers);
    const { userId } = await ctx.params;
    await removeMember(me, userId);
    return new Response(null, { status: 204 });
  },
);

// Promote a member to owner, or demote an owner to member (spec 041).
// Owner-only — unlike DELETE above, there's no self exception: a member
// can never change any role, including their own.
export const PATCH = route(
  async (request, ctx: RouteContext<"/api/members/[userId]">) => {
    const me = await requireHousehold(request.headers, { role: "owner" });
    const { userId } = await ctx.params;
    const body = await readJson(request);
    const role = parseRole(body.role);
    await updateMemberRole(me, userId, role);
    return new Response(null, { status: 204 });
  },
);
