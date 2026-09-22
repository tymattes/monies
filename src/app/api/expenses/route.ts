import { addExpense } from "@/lib/expenses";
import { requireHousehold } from "@/lib/household";
import { readJson, route } from "@/lib/http";
import { parseDate } from "@/lib/months";
import { parseAmount, parseNote, uuidParam } from "@/lib/validate";

// Logs a fact: money spent on a category on a given date (spec 019).
export const POST = route(async (request) => {
  const me = await requireHousehold(request.headers);
  const body = await readJson(request);
  const expense = await addExpense(me, {
    categoryId: uuidParam(String(body.categoryId ?? ""), "Category"),
    amountCents: parseAmount(body.amountCents, 1),
    spentOn: parseDate(body.spentOn),
    description: parseNote(body.description),
  });
  return Response.json({ expense }, { status: 201 });
});
