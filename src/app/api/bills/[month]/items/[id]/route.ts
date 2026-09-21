import { isInterval, monthlyEquivalent, setBillVersion } from "@/lib/bills";
import { requireHousehold } from "@/lib/household";
import { HttpError, readJson, route } from "@/lib/http";
import { parseMonth } from "@/lib/months";
import { parseAmount, uuidParam } from "@/lib/validate";

// New amount, billing period and category from this month onward (current or
// future months only). All three are required so a version is always complete.
export const PUT = route(
  async (request, ctx: RouteContext<"/api/bills/[month]/items/[id]">) => {
    const me = await requireHousehold(request.headers);
    const params = await ctx.params;
    const month = parseMonth(params.month);
    const id = uuidParam(params.id, "Bill");
    const body = await readJson(request);
    const amountCents = parseAmount(body.amountCents, 0);
    if (!isInterval(body.intervalMonths)) {
      throw new HttpError(400, "intervalMonths must be 1, 3, 6 or 12");
    }
    if (typeof body.categoryId !== "string" || body.categoryId === "") {
      throw new HttpError(400, "Choose a category");
    }
    await setBillVersion(me, month, id, {
      amountCents,
      intervalMonths: body.intervalMonths,
      categoryId: body.categoryId,
    });
    return Response.json({
      month,
      billId: id,
      amountCents,
      intervalMonths: body.intervalMonths,
      monthlyCents: monthlyEquivalent(amountCents, body.intervalMonths),
      categoryId: body.categoryId,
    });
  },
);
