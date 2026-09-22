import { createGoal, listGoals } from "@/lib/goals";
import { requireHousehold } from "@/lib/household";
import { HttpError, readJson, route, str } from "@/lib/http";
import { parseGoalType } from "@/lib/validate";

export const GET = route(async (request) => {
  const ctx = await requireHousehold(request.headers);
  return Response.json({ goals: await listGoals(ctx.household.id) });
});

export const POST = route(async (request) => {
  const ctx = await requireHousehold(request.headers);
  const body = await readJson(request);
  const name = str(body, "name", { max: 60 });
  const type = parseGoalType(body.type);
  if (type === undefined) {
    throw new HttpError(400, "type is required");
  }
  return Response.json(
    { goal: await createGoal(ctx, name, type) },
    { status: 201 },
  );
});
