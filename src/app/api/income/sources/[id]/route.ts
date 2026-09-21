import { requireHousehold } from "@/lib/household";
import { HttpError, readJson, route, str } from "@/lib/http";
import { updateSource } from "@/lib/income";
import { uuidParam } from "@/lib/validate";

export const PATCH = route(
  async (request, ctx: RouteContext<"/api/income/sources/[id]">) => {
    const me = await requireHousehold(request.headers);
    const id = uuidParam((await ctx.params).id, "Income source");
    const body = await readJson(request);
    const patch: { name?: string; archived?: boolean } = {};
    if (body.name !== undefined) patch.name = str(body, "name", { max: 60 });
    if (body.archived !== undefined) {
      if (typeof body.archived !== "boolean") {
        throw new HttpError(400, "archived must be true or false");
      }
      patch.archived = body.archived;
    }
    if (Object.keys(patch).length === 0) {
      throw new HttpError(400, "Nothing to update");
    }
    await updateSource(me, id, patch);
    return new Response(null, { status: 204 });
  },
);
