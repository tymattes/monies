import { requireHousehold } from "@/lib/household";
import { readJson, route } from "@/lib/http";
import { addDeposit } from "@/lib/income";
import { parseDate } from "@/lib/months";
import { parseAmount, parseNote, uuidParam } from "@/lib/validate";

// Records money actually received on a variable source (counts in the month of `receivedOn`).
export const POST = route(
  async (request, ctx: RouteContext<"/api/income/sources/[id]/deposits">) => {
    const me = await requireHousehold(request.headers);
    const id = uuidParam((await ctx.params).id, "Income source");
    const body = await readJson(request);
    const deposit = await addDeposit(me, id, {
      receivedOn: parseDate(body.receivedOn),
      amountCents: parseAmount(body.amountCents, 1),
      note: parseNote(body.note),
    });
    return Response.json({ deposit }, { status: 201 });
  },
);
