import { expect } from "vitest";
import * as householdRoute from "@/app/api/household/route";
import * as invitesRoute from "@/app/api/invites/route";
import * as joinRoute from "@/app/api/join/[token]/route";
import * as setupRoute from "@/app/api/setup/route";

export type Handler = (request: Request, ctx: never) => Promise<Response>;

export async function call(
  handler: Handler,
  path: string,
  opts: {
    method?: string;
    body?: unknown;
    cookie?: string;
    params?: Record<string, string>;
  } = {},
) {
  const headers = new Headers();
  if (opts.cookie) headers.set("cookie", opts.cookie);
  if (opts.body !== undefined) headers.set("content-type", "application/json");
  const request = new Request(`http://localhost:3000${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const res = await handler(request, {
    params: Promise.resolve(opts.params ?? {}),
  } as never);
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {}
  return { res, status: res.status, json };
}

export const cookieOf = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

export const OWNER = {
  householdName: "The Smiths",
  name: "Olive Owner",
  email: "owner@example.com",
  password: "correct horse battery",
};

export async function setupOwner() {
  const { res, status } = await call(setupRoute.POST, "/api/setup", {
    method: "POST",
    body: OWNER,
  });
  expect(status).toBe(201);
  return cookieOf(res);
}

export async function invite(ownerCookie: string) {
  const { status, json } = await call(invitesRoute.POST, "/api/invites", {
    method: "POST",
    cookie: ownerCookie,
  });
  expect(status).toBe(201);
  return json as { id: string; token: string; path: string };
}

export async function join(token: string, email = "member@example.com") {
  return call(joinRoute.POST, `/api/join/${token}`, {
    method: "POST",
    params: { token },
    body: { name: "Mia Member", email, password: "another good password" },
  });
}

export async function joinAsMember(ownerCookie: string) {
  const { token } = await invite(ownerCookie);
  const { res, status } = await join(token);
  expect(status).toBe(201);
  const cookie = cookieOf(res);
  const me = await call(householdRoute.GET, "/api/household", { cookie });
  const userId = (me.json.me as { id: string }).id;
  return { cookie, userId };
}
