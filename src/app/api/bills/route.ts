import { createBill, isInterval } from "@/lib/bills";
import { requireHousehold } from "@/lib/household";
import { HttpError, readJson, route, str } from "@/lib/http";
import { parseAmount, parseLabel, parseMemberId } from "@/lib/validate";

// Adds a recurring bill, effective from the current month. The category is
// required (the user chooses it; there is no default).
export const POST = route(async (request) => {
  const me = await requireHousehold(request.headers);
  const body = await readJson(request);
  if (typeof body.categoryId !== "string" || body.categoryId === "") {
    throw new HttpError(400, "Choose a category");
  }
  const intervalMonths = body.intervalMonths === undefined ? 1 : body.intervalMonths;
  if (!isInterval(intervalMonths)) {
    throw new HttpError(400, "intervalMonths must be 1, 3, 6 or 12");
  }
  const created = await createBill(me, {
    name: str(body, "name", { max: 100 }),
    amountCents: parseAmount(body.amountCents, 0),
    intervalMonths,
    categoryId: body.categoryId,
    paidBy: parseMemberId(body.paidBy, "paidBy") ?? null,
    note: parseLabel(body.note, "note", 200) ?? null,
  });
  return Response.json({ bill: created }, { status: 201 });
});
