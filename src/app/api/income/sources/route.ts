import { requireHousehold } from "@/lib/household";
import { HttpError, readJson, route, str } from "@/lib/http";
import { createSource, listSources } from "@/lib/income";
import { parseOptionalAmount } from "@/lib/validate";

export const GET = route(async (request) => {
  const me = await requireHousehold(request.headers);
  return Response.json({ sources: await listSources(me) });
});

// `memberId` defaults to the caller; only an owner may add income for someone
// else. `amountCents` is optional — a fixed source's starting amount, set in
// the same step (spec 030); variable sources don't take one.
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
  const amountCents = parseOptionalAmount(body.amountCents);
  const source = await createSource(me, {
    name,
    kind: body.kind,
    memberId: body.memberId,
    amountCents,
  });
  return Response.json({ source }, { status: 201 });
});
