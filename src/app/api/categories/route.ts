import { createCategory, listCategories } from "@/lib/categories";
import { requireHousehold } from "@/lib/household";
import { readJson, route, str } from "@/lib/http";
import { parseCategoryType } from "@/lib/validate";

export const GET = route(async (request) => {
  const ctx = await requireHousehold(request.headers);
  return Response.json({ categories: await listCategories(ctx.household.id) });
});

export const POST = route(async (request) => {
  const ctx = await requireHousehold(request.headers);
  const body = await readJson(request);
  const name = str(body, "name", { max: 60 });
  const type = parseCategoryType(body.type) ?? "spending";
  return Response.json(
    { category: await createCategory(ctx, name, type) },
    { status: 201 },
  );
});
