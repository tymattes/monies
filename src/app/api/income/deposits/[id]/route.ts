import { requireHousehold } from "@/lib/household";
import { HttpError, readJson, route } from "@/lib/http";
import { deleteDeposit, updateDeposit } from "@/lib/income";
import { parseDate } from "@/lib/months";
import { parseAmount, parseNote, uuidParam } from "@/lib/validate";

export const PATCH = route(
  async (request, ctx: RouteContext<"/api/income/deposits/[id]">) => {
    const me = await requireHousehold(request.headers);
    const id = uuidParam((await ctx.params).id, "Deposit");
    const body = await readJson(request);
    const patch: Parameters<typeof updateDeposit>[2] = {};
    if (body.receivedOn !== undefined) patch.receivedOn = parseDate(body.receivedOn);
    if (body.amountCents !== undefined) patch.amountCents = parseAmount(body.amountCents, 1);
    if (body.note !== undefined) patch.note = parseNote(body.note);
    if (Object.keys(patch).length === 0) {
      throw new HttpError(400, "Nothing to update");
    }
    await updateDeposit(me, id, patch);
    return new Response(null, { status: 204 });
  },
);

export const DELETE = route(
  async (request, ctx: RouteContext<"/api/income/deposits/[id]">) => {
    const me = await requireHousehold(request.headers);
    const id = uuidParam((await ctx.params).id, "Deposit");
    await deleteDeposit(me, id);
    return new Response(null, { status: 204 });
  },
);
