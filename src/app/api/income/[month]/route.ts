import { requireHousehold } from "@/lib/household";
import { route } from "@/lib/http";
import { getIncomeMonth } from "@/lib/income";
import { parseMonth } from "@/lib/months";

export const GET = route(
  async (request, ctx: RouteContext<"/api/income/[month]">) => {
    const me = await requireHousehold(request.headers);
    const month = parseMonth((await ctx.params).month);
    return Response.json(await getIncomeMonth(me, month));
  },
);
