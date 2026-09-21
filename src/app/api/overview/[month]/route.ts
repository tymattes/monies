import { requireHousehold } from "@/lib/household";
import { route } from "@/lib/http";
import { parseMonth } from "@/lib/months";
import { getOverview } from "@/lib/overview";

// Everything the Overview page shows for one month, so a future native client
// gets the same numbers. Read-only; any household member may call it.
export const GET = route(
  async (request, ctx: RouteContext<"/api/overview/[month]">) => {
    const me = await requireHousehold(request.headers);
    const month = parseMonth((await ctx.params).month);
    return Response.json(await getOverview(me, month));
  },
);
