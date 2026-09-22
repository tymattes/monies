import { getExpensesMonth } from "@/lib/expenses";
import { requireHousehold } from "@/lib/household";
import { route } from "@/lib/http";
import { parseMonth } from "@/lib/months";

export const GET = route(
  async (request, ctx: RouteContext<"/api/expenses/month/[month]">) => {
    const me = await requireHousehold(request.headers);
    const month = parseMonth((await ctx.params).month);
    return Response.json(await getExpensesMonth(me, month));
  },
);
