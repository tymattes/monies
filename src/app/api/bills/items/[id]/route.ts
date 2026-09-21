import { updateBill } from "@/lib/bills";
import { requireHousehold } from "@/lib/household";
import { HttpError, readJson, route, str } from "@/lib/http";
import { parseLabel, uuidParam } from "@/lib/validate";

// Rename, change the paid-with label or note, or end/restore a bill. These
// labels are not versioned; amount, period and category go through the month route.
export const PATCH = route(
  async (request, ctx: RouteContext<"/api/bills/items/[id]">) => {
    const me = await requireHousehold(request.headers);
    const id = uuidParam((await ctx.params).id, "Bill");
    const body = await readJson(request);
    const patch: Parameters<typeof updateBill>[2] = {};
    if (body.name !== undefined) patch.name = str(body, "name", { max: 100 });
    if (body.paidWith !== undefined) patch.paidWith = parseLabel(body.paidWith, "paidWith", 60);
    if (body.note !== undefined) patch.note = parseLabel(body.note, "note", 200);
    if (body.archived !== undefined) {
      if (typeof body.archived !== "boolean") {
        throw new HttpError(400, "archived must be true or false");
      }
      patch.archived = body.archived;
    }
    if (Object.keys(patch).length === 0) {
      throw new HttpError(400, "Nothing to update");
    }
    await updateBill(me, id, patch);
    return new Response(null, { status: 204 });
  },
);
