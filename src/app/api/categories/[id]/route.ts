import { updateCategory, type CategoryPatch } from "@/lib/categories";
import { requireHousehold } from "@/lib/household";
import { HttpError, readJson, route, str } from "@/lib/http";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Rename, archive/unarchive, or move a category (position is a 0-based index
// among active categories).
export const PATCH = route(
  async (request, ctx: RouteContext<"/api/categories/[id]">) => {
    const me = await requireHousehold(request.headers);
    const { id } = await ctx.params;
    if (!UUID.test(id)) throw new HttpError(404, "Category not found");
    const body = await readJson(request);

    const patch: CategoryPatch = {};
    if (body.name !== undefined) patch.name = str(body, "name", { max: 60 });
    if (body.archived !== undefined) {
      if (typeof body.archived !== "boolean") {
        throw new HttpError(400, "archived must be true or false");
      }
      patch.archived = body.archived;
    }
    if (body.position !== undefined) {
      if (!Number.isInteger(body.position) || (body.position as number) < 0) {
        throw new HttpError(400, "position must be a non-negative integer");
      }
      patch.position = body.position as number;
    }
    if (Object.keys(patch).length === 0) {
      throw new HttpError(400, "Nothing to update");
    }
    await updateCategory(me, id, patch);
    return new Response(null, { status: 204 });
  },
);
