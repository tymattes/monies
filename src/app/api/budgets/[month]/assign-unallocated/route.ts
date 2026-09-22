import { MAX_ASSIGNMENTS, assignUnallocated, type Assignment } from "@/lib/budgets";
import { requireHousehold } from "@/lib/household";
import { HttpError, readJson, route } from "@/lib/http";
import { parseMonth } from "@/lib/months";
import { parseAmount, uuidParam } from "@/lib/validate";

// Puts part or all of the month's unallocated amount into one or more goals
// (spec 014, narrowed to goals-only in spec 020), from this month onward,
// atomically. Body is either `{ assignments: [{ goalId, amountCents }, ...] }`
// or `{ goalId }` (shorthand for all of it into one). A `categoryId` anywhere
// is the old shape (removed in spec 020) and gets a named error pointing at
// Expenses as the replacement.
export const POST = route(
  async (request, ctx: RouteContext<"/api/budgets/[month]/assign-unallocated">) => {
    const me = await requireHousehold(request.headers);
    const month = parseMonth((await ctx.params).month);
    const body = await readJson(request);

    // Reject the removed category target before doing anything else, so the
    // old shape never falls through to a generic validation error — even when
    // it rides alongside a valid goalId (spec 020's named-error requirement).
    if (typeof (body as Record<string, unknown>).categoryId === "string") {
      throw new HttpError(
        400,
        "categoryId is no longer a valid Assign target — log an Expense against the category instead",
      );
    }

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
        if (typeof a.categoryId === "string") {
          throw new HttpError(
            400,
            "categoryId is no longer a valid Assign target — log an Expense against the category instead",
          );
        }
        if (typeof a.goalId !== "string") {
          throw new HttpError(400, "Each assignment needs a goalId");
        }
        return { goalId: uuidParam(a.goalId, "Goal"), amountCents: parseAmount(a.amountCents, 1) };
      });
      return Response.json(await assignUnallocated(me, month, { assignments }));
    }

    if (typeof body.goalId !== "string") {
      throw new HttpError(400, "goalId or assignments is required");
    }
    return Response.json(
      await assignUnallocated(me, month, { goalId: uuidParam(body.goalId, "Goal") }),
    );
  },
);
