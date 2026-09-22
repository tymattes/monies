import { deleteExpense } from "@/lib/expenses";
import { requireHousehold } from "@/lib/household";
import { route } from "@/lib/http";
import { uuidParam } from "@/lib/validate";

export const DELETE = route(
  async (request, ctx: RouteContext<"/api/expenses/[id]">) => {
    const me = await requireHousehold(request.headers);
    const id = uuidParam((await ctx.params).id, "Expense");
    await deleteExpense(me, id);
    return Response.json({ ok: true });
  },
);
