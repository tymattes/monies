import { setGoalCheckin } from "@/lib/goals";
import { requireHousehold } from "@/lib/household";
import { HttpError, readJson, route } from "@/lib/http";
import { parseMonth } from "@/lib/months";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Checks or unchecks a goal for a month. Unlike an amount, this has no
// read-only-past rule (spec 014) — any month, including past ones, can be
// toggled, since it records a fact rather than a plan.
export const PUT = route(
  async (request, ctx: RouteContext<"/api/goals/month/[month]/checkins/[id]">) => {
    const me = await requireHousehold(request.headers);
    const params = await ctx.params;
    const month = parseMonth(params.month);
    if (!UUID.test(params.id)) {
      throw new HttpError(404, "Goal not found for this month");
    }
    const { checked } = await readJson(request);
    if (typeof checked !== "boolean") {
      throw new HttpError(400, "checked must be true or false");
    }
    await setGoalCheckin(me, month, params.id, checked);
    return Response.json({ month, goalId: params.id, checked });
  },
);
