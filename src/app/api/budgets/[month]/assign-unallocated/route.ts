import { MAX_ASSIGNMENTS, assignUnallocated, type Assignment } from "@/lib/budgets";
import { requireHousehold } from "@/lib/household";
import { HttpError, readJson, route } from "@/lib/http";
import { parseMonth } from "@/lib/months";
import { parseAmount, uuidParam } from "@/lib/validate";

// Puts part or all of the month's unallocated amount into one or more
// categories or goals (spec 014), from this month onward, atomically. Body
// is either `{ assignments: [{ categoryId | goalId, amountCents }, ...] }`
// or `{ categoryId }` / `{ goalId }` (shorthand for all of it into one).
export const POST = route(
  async (request, ctx: RouteContext<"/api/budgets/[month]/assign-unallocated">) => {
    const me = await requireHousehold(request.headers);
    const month = parseMonth((await ctx.params).month);
    const body = await readJson(request);

    if (body.assignments !== undefined) {
      if (
        !Array.isArray(body.assignments) ||
        body.assignments.length === 0 ||
        body.assignments.length > MAX_ASSIGNMENTS
      ) {
        throw new HttpError(
          400,
          `assignments must be a list of 1 to ${MAX_ASSIGNMENTS} items`,
        );
      }
      const assignments: Assignment[] = body.assignments.map((item: unknown) => {
        const a = (item ?? {}) as Record<string, unknown>;
        if (typeof a.goalId === "string") {
          return { goalId: uuidParam(a.goalId, "Goal"), amountCents: parseAmount(a.amountCents, 1) };
        }
        if (typeof a.categoryId !== "string") {
          throw new HttpError(400, "Each assignment needs a categoryId or goalId");
        }
        return {
          categoryId: uuidParam(a.categoryId, "Category"),
          amountCents: parseAmount(a.amountCents, 1),
        };
      });
      return Response.json(await assignUnallocated(me, month, { assignments }));
    }

    if (typeof body.goalId === "string") {
      return Response.json(await assignUnallocated(me, month, { goalId: uuidParam(body.goalId, "Goal") }));
    }
    if (typeof body.categoryId !== "string") {
      throw new HttpError(400, "categoryId, goalId, or assignments is required");
    }
    const categoryId = uuidParam(body.categoryId, "Category");
    return Response.json(await assignUnallocated(me, month, { categoryId }));
  },
);
