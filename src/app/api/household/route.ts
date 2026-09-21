import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { households } from "@/db/schema";
import { requireHousehold } from "@/lib/household";
import { readJson, route, str } from "@/lib/http";

export const GET = route(async (request) => {
  const ctx = await requireHousehold(request.headers);
  return Response.json({
    household: ctx.household,
    me: { ...ctx.user, role: ctx.role },
  });
});

export const PATCH = route(async (request) => {
  const ctx = await requireHousehold(request.headers, { role: "owner" });
  const name = str(await readJson(request), "name", { max: 100 });
  await getDb()
    .update(households)
    .set({ name })
    .where(eq(households.id, ctx.household.id));
  return Response.json({ household: { id: ctx.household.id, name } });
});
