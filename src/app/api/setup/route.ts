import { signInResponse } from "@/lib/accounts";
import { HttpError, parseCredentials, readJson, route, str } from "@/lib/http";
import { isValidCurrency } from "@/lib/money";
import { isSetupNeeded, runSetup } from "@/lib/setup";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  return Response.json({ needsSetup: await isSetupNeeded() });
});

// First-run only: creates the household, its owner, and signs the owner in.
export const POST = route(async (request) => {
  const body = await readJson(request);
  const credentials = parseCredentials(body);
  const householdName = str(body, "householdName", { max: 100 });
  const currency = body.currency === undefined ? "USD" : body.currency;
  if (!isValidCurrency(currency)) {
    throw new HttpError(400, "currency must be a valid ISO 4217 code");
  }
  if (!(await isSetupNeeded())) {
    throw new HttpError(409, "This instance is already set up");
  }
  await runSetup({ householdName, currency, ...credentials });
  return signInResponse(
    credentials.email,
    credentials.password,
    request.headers,
    { ok: true },
    201,
  );
});
