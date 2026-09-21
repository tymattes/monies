import { requireHousehold } from "@/lib/household";
import { readJson, route } from "@/lib/http";
import { setFixedAmount } from "@/lib/income";
import { parseMonth } from "@/lib/months";
import { parseAmount, uuidParam } from "@/lib/validate";

// Sets a fixed source's monthly amount from this month onward (current or future months only).
export const PUT = route(
  async (request, ctx: RouteContext<"/api/income/[month]/sources/[id]">) => {
    const me = await requireHousehold(request.headers);
    const params = await ctx.params;
    const month = parseMonth(params.month);
    const id = uuidParam(params.id, "Income source");
    const amountCents = parseAmount((await readJson(request)).amountCents);
    await setFixedAmount(me, month, id, amountCents);
    return Response.json({ month, sourceId: id, amountCents });
  },
);
