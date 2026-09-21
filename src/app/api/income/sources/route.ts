import { requireHousehold } from "@/lib/household";
import { HttpError, readJson, route, str } from "@/lib/http";
import { createSource, listSources } from "@/lib/income";

export const GET = route(async (request) => {
  const me = await requireHousehold(request.headers);
  return Response.json({ sources: await listSources(me) });
});

// `memberId` defaults to the caller; only an owner may add income for someone else.
export const POST = route(async (request) => {
  const me = await requireHousehold(request.headers);
  const body = await readJson(request);
  const name = str(body, "name", { max: 60 });
  if (body.kind !== "fixed" && body.kind !== "variable") {
    throw new HttpError(400, "kind must be fixed or variable");
  }
  if (body.memberId !== undefined && typeof body.memberId !== "string") {
    throw new HttpError(400, "memberId must be a string");
  }
  const source = await createSource(me, {
    name,
    kind: body.kind,
    memberId: body.memberId,
  });
  return Response.json({ source }, { status: 201 });
});
