import { createCategory, listCategories } from "@/lib/categories";
import { requireHousehold } from "@/lib/household";
import { readJson, route, str } from "@/lib/http";

export const GET = route(async (request) => {
  const ctx = await requireHousehold(request.headers);
  return Response.json({ categories: await listCategories(ctx.household.id) });
});

export const POST = route(async (request) => {
  const ctx = await requireHousehold(request.headers);
  const name = str(await readJson(request), "name", { max: 60 });
  return Response.json({ category: await createCategory(ctx, name) }, { status: 201 });
});
