import { assignUnallocated } from "@/lib/budgets";
import { requireHousehold } from "@/lib/household";
import { HttpError, readJson, route } from "@/lib/http";
import { parseMonth } from "@/lib/months";
import { uuidParam } from "@/lib/validate";

// Puts the month's unallocated amount into one category, from this month onward.
export const POST = route(
  async (request, ctx: RouteContext<"/api/budgets/[month]/assign-unallocated">) => {
    const me = await requireHousehold(request.headers);
    const month = parseMonth((await ctx.params).month);
    const { categoryId } = await readJson(request);
    if (typeof categoryId !== "string") {
      throw new HttpError(400, "categoryId is required");
    }
    uuidParam(categoryId, "Category");
    return Response.json(await assignUnallocated(me, month, categoryId));
  },
);
