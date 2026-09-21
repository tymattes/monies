import { signInResponse } from "@/lib/accounts";
import { parseCredentials, readJson, route } from "@/lib/http";
import { acceptInvite, INVITE_MESSAGES, lookupInvite } from "@/lib/invites";

// Public: an invite token is the credential. Check whether a link is usable.
export const GET = route(async (_request, ctx: RouteContext<"/api/join/[token]">) => {
  const { token } = await ctx.params;
  const { status, householdName } = await lookupInvite(token);
  if (status !== "valid") {
    return Response.json({ status, error: INVITE_MESSAGES[status] }, { status: 410 });
  }
  return Response.json({ status, householdName });
});

// Public: redeem the invite by creating an account, then sign in.
export const POST = route(async (request, ctx: RouteContext<"/api/join/[token]">) => {
  const { token } = await ctx.params;
  const credentials = parseCredentials(await readJson(request));
  await acceptInvite(token, credentials);
  return signInResponse(
    credentials.email,
    credentials.password,
    request.headers,
    { ok: true },
    201,
  );
});
