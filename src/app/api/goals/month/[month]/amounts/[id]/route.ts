import { MAX_AMOUNT } from "@/lib/budgets";
import { setGoalAmount } from "@/lib/goals";
import { requireHousehold } from "@/lib/household";
import { HttpError, readJson, route } from "@/lib/http";
import { parseMonth } from "@/lib/months";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Sets the goal's amount from this month onward (current or future months only).
export const PUT = route(
  async (request, ctx: RouteContext<"/api/goals/month/[month]/amounts/[id]">) => {
    const me = await requireHousehold(request.headers);
    const params = await ctx.params;
    const month = parseMonth(params.month);
    if (!UUID.test(params.id)) {
      throw new HttpError(404, "Goal not found for this month");
    }
    const { amountCents } = await readJson(request);
    if (
      typeof amountCents !== "number" ||
      !Number.isInteger(amountCents) ||
      amountCents < 0 ||
      amountCents > MAX_AMOUNT
    ) {
      throw new HttpError(
        400,
        `amountCents must be an integer between 0 and ${MAX_AMOUNT}`,
      );
    }
    await setGoalAmount(me, month, params.id, amountCents);
    return Response.json({ month, goalId: params.id, amountCents });
  },
);
