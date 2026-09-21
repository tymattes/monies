import { getBudget } from "@/lib/budgets";
import { requireHousehold } from "@/lib/household";
import { route } from "@/lib/http";
import { parseMonth } from "@/lib/months";

export const GET = route(
  async (request, ctx: RouteContext<"/api/budgets/[month]">) => {
    const me = await requireHousehold(request.headers);
    const month = parseMonth((await ctx.params).month);
    return Response.json(await getBudget(me, month));
  },
);
