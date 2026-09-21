import { randomUUID } from "node:crypto";
import { getDb } from "@/db";
import { account, user } from "@/db/schema";
import { getAuth } from "./auth";
import { HttpError, isUniqueViolation } from "./http";

export type Tx = Parameters<
  Parameters<ReturnType<typeof getDb>["transaction"]>[0]
>[0];

// Creates a user with an email/password credential inside the caller's
// transaction. Better Auth's public sign-up endpoint is disabled, so this is
// the only way accounts come into existence (first-run setup and invite accept).
export async function insertUserWithPassword(
  tx: Tx,
  input: { name: string; email: string; password: string },
): Promise<string> {
  const ctx = await getAuth().$context;
  const passwordHash = await ctx.password.hash(input.password);
  const userId = randomUUID();
  try {
    await tx.insert(user).values({
      id: userId,
      name: input.name,
      email: input.email,
    });
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new HttpError(409, "An account with this email already exists");
    }
    throw e;
  }
  await tx.insert(account).values({
    id: randomUUID(),
    accountId: userId,
    providerId: "credential",
    userId,
    password: passwordHash,
  });
  return userId;
}

// Signs the user in through Better Auth and returns a JSON response carrying
// its session cookie(s).
export async function signInResponse(
  email: string,
  password: string,
  headers: Headers,
  body: unknown = { ok: true },
  status = 200,
): Promise<Response> {
  const res = await getAuth().api.signInEmail({
    body: { email, password },
    headers,
    asResponse: true,
  });
  if (!res.ok) throw new HttpError(500, "Account created but sign-in failed");
  const out = Response.json(body, { status });
  for (const cookie of res.headers.getSetCookie()) {
    out.headers.append("set-cookie", cookie);
  }
  return out;
}
