import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import * as authRoute from "@/app/api/auth/[...all]/route";
import * as householdRoute from "@/app/api/household/route";
import * as invitesRoute from "@/app/api/invites/route";
import * as inviteRoute from "@/app/api/invites/[id]/route";
import * as joinRoute from "@/app/api/join/[token]/route";
import * as memberRoute from "@/app/api/members/[userId]/route";
import * as membersRoute from "@/app/api/members/route";
import * as setupRoute from "@/app/api/setup/route";
import { getDb, getSql } from "@/db";
import { account, households, invites, user } from "@/db/schema";
import { insertUserWithPassword, signInResponse } from "@/lib/accounts";
import {
  call,
  cookieOf,
  invite,
  join,
  joinAsMember,
  OWNER,
  setupOwner,
} from "./helpers";

beforeEach(async () => {
  await getSql()`truncate "user", households, invites, verification cascade`;
});

describe("first-run setup", () => {
  it("creates the household and owner, then signs them in", async () => {
    expect((await call(setupRoute.GET, "/api/setup")).json.needsSetup).toBe(true);

    const cookie = await setupOwner();
    const me = await call(householdRoute.GET, "/api/household", { cookie });
    expect(me.status).toBe(200);
    expect(me.json.household).toMatchObject({ name: "The Smiths" });
    expect(me.json.me).toMatchObject({ email: OWNER.email, role: "owner" });

    expect((await call(setupRoute.GET, "/api/setup")).json.needsSetup).toBe(false);
  });

  it("rejects a second setup", async () => {
    await setupOwner();
    const again = await call(setupRoute.POST, "/api/setup", {
      method: "POST",
      body: { ...OWNER, email: "other@example.com" },
    });
    expect(again.status).toBe(409);
  });

  it("stores passwords hashed", async () => {
    await setupOwner();
    const [row] = await getDb().select().from(account);
    expect(row.password).toBeTruthy();
    expect(row.password).not.toContain(OWNER.password);
  });
});

describe("one household per instance", () => {
  it("is enforced by the database", async () => {
    await setupOwner();
    await expect(
      getDb().insert(households).values({ name: "Second" }),
    ).rejects.toThrow();
    await expect(
      getDb().execute(sql`insert into households (name, singleton) values ('x', false)`),
    ).rejects.toThrow();
  });
});

describe("access control", () => {
  it("rejects signed-out requests to every household-scoped route", async () => {
    await setupOwner();
    const userId = "00000000-0000-0000-0000-000000000000";
    const results = await Promise.all([
      call(householdRoute.GET, "/api/household"),
      call(householdRoute.PATCH, "/api/household", { method: "PATCH", body: { name: "x" } }),
      call(membersRoute.GET, "/api/members"),
      call(memberRoute.DELETE, `/api/members/${userId}`, { method: "DELETE", params: { userId } }),
      call(memberRoute.PATCH, `/api/members/${userId}`, {
        method: "PATCH", params: { userId }, body: { role: "owner" },
      }),
      call(invitesRoute.GET, "/api/invites"),
      call(invitesRoute.POST, "/api/invites", { method: "POST" }),
      call(inviteRoute.DELETE, `/api/invites/${userId}`, { method: "DELETE", params: { id: userId } }),
    ]);
    expect(results.map((r) => r.status)).toEqual(Array(8).fill(401));
  });

  it("rejects a signed-in user who is not a household member", async () => {
    await setupOwner();
    await getDb().transaction((tx) =>
      insertUserWithPassword(tx, {
        name: "Stranger",
        email: "stranger@example.com",
        password: "stranger password",
      }),
    );
    const signedIn = await signInResponse(
      "stranger@example.com",
      "stranger password",
      new Headers(),
    );
    const cookie = cookieOf(signedIn);
    expect((await call(householdRoute.GET, "/api/household", { cookie })).status).toBe(403);
    expect((await call(membersRoute.GET, "/api/members", { cookie })).status).toBe(403);
  });

  it("keeps public sign-up closed", async () => {
    const { status } = await call(authRoute.POST, "/api/auth/sign-up/email", {
      method: "POST",
      body: { name: "Eve", email: "eve@example.com", password: "eve password 123" },
    });
    expect(status).toBeGreaterThanOrEqual(400);
    expect(await getDb().select().from(user)).toHaveLength(0);
  });

  it("limits owner-only actions to owners", async () => {
    const owner = await setupOwner();
    const { cookie } = await joinAsMember(owner);
    const create = await call(invitesRoute.POST, "/api/invites", { method: "POST", cookie });
    expect(create.status).toBe(403);
    const list = await call(invitesRoute.GET, "/api/invites", { cookie });
    expect(list.status).toBe(403);
    const rename = await call(householdRoute.PATCH, "/api/household", {
      method: "PATCH",
      cookie,
      body: { name: "Mine now" },
    });
    expect(rename.status).toBe(403);
  });
});

describe("invites", () => {
  it("lets a new person join once, as a member", async () => {
    const owner = await setupOwner();
    const { token } = await invite(owner);

    const lookup = await call(joinRoute.GET, `/api/join/${token}`, { params: { token } });
    expect(lookup.status).toBe(200);
    expect(lookup.json.householdName).toBe("The Smiths");

    const joined = await join(token);
    expect(joined.status).toBe(201);
    const me = await call(householdRoute.GET, "/api/household", { cookie: cookieOf(joined.res) });
    expect(me.json.me).toMatchObject({ email: "member@example.com", role: "member" });

    const members = await call(membersRoute.GET, "/api/members", { cookie: owner });
    expect((members.json.members as unknown[]).length).toBe(2);

    const reuse = await join(token, "third@example.com");
    expect(reuse.status).toBe(410);
    expect(reuse.json.error).toMatch(/already been used/);
  });

  it("stores only a hash of the token", async () => {
    const owner = await setupOwner();
    const { token } = await invite(owner);
    const [row] = await getDb().select().from(invites);
    expect(row.tokenHash).not.toBe(token);
    expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects revoked links", async () => {
    const owner = await setupOwner();
    const { id, token } = await invite(owner);
    const revoke = await call(inviteRoute.DELETE, `/api/invites/${id}`, {
      method: "DELETE",
      cookie: owner,
      params: { id },
    });
    expect(revoke.status).toBe(204);
    const attempt = await join(token);
    expect(attempt.status).toBe(410);
    expect(attempt.json.error).toMatch(/revoked/);
  });

  it("rejects expired links", async () => {
    const owner = await setupOwner();
    const { id, token } = await invite(owner);
    await getDb()
      .update(invites)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(invites.id, id));
    const attempt = await join(token);
    expect(attempt.status).toBe(410);
    expect(attempt.json.error).toMatch(/expired/);
  });

  it("rejects unknown tokens", async () => {
    await setupOwner();
    const attempt = await join("not-a-real-token");
    expect(attempt.status).toBe(410);
    expect(attempt.json.error).toMatch(/not valid/);
  });

  it("does not burn the invite when the email is already taken", async () => {
    const owner = await setupOwner();
    const { token } = await invite(owner);
    const taken = await join(token, OWNER.email);
    expect(taken.status).toBe(409);
    expect((await join(token)).status).toBe(201);
  });

  it("lists only pending invites", async () => {
    const owner = await setupOwner();
    const first = await invite(owner);
    await invite(owner);
    await join(first.token);
    const list = await call(invitesRoute.GET, "/api/invites", { cookie: owner });
    expect((list.json.invites as unknown[]).length).toBe(1);
  });
});

describe("members", () => {
  it("removing a member ends their session", async () => {
    const owner = await setupOwner();
    const member = await joinAsMember(owner);
    expect((await call(householdRoute.GET, "/api/household", { cookie: member.cookie })).status).toBe(200);

    const removed = await call(memberRoute.DELETE, `/api/members/${member.userId}`, {
      method: "DELETE",
      cookie: owner,
      params: { userId: member.userId },
    });
    expect(removed.status).toBe(204);
    expect((await call(householdRoute.GET, "/api/household", { cookie: member.cookie })).status).toBe(401);
  });

  it("does not let a member remove someone else", async () => {
    const owner = await setupOwner();
    const member = await joinAsMember(owner);
    const ownerId = (
      (await call(householdRoute.GET, "/api/household", { cookie: owner })).json.me as { id: string }
    ).id;
    const attempt = await call(memberRoute.DELETE, `/api/members/${ownerId}`, {
      method: "DELETE",
      cookie: member.cookie,
      params: { userId: ownerId },
    });
    expect(attempt.status).toBe(403);
  });

  it("lets a member leave", async () => {
    const owner = await setupOwner();
    const member = await joinAsMember(owner);
    const left = await call(memberRoute.DELETE, `/api/members/${member.userId}`, {
      method: "DELETE",
      cookie: member.cookie,
      params: { userId: member.userId },
    });
    expect(left.status).toBe(204);
    const members = await call(membersRoute.GET, "/api/members", { cookie: owner });
    expect((members.json.members as unknown[]).length).toBe(1);
  });

  it("never lets the last owner leave", async () => {
    const owner = await setupOwner();
    const ownerId = (
      (await call(householdRoute.GET, "/api/household", { cookie: owner })).json.me as { id: string }
    ).id;
    const attempt = await call(memberRoute.DELETE, `/api/members/${ownerId}`, {
      method: "DELETE",
      cookie: owner,
      params: { userId: ownerId },
    });
    expect(attempt.status).toBe(409);
  });

  it("lets the owner rename the household", async () => {
    const owner = await setupOwner();
    const renamed = await call(householdRoute.PATCH, "/api/household", {
      method: "PATCH",
      cookie: owner,
      body: { name: "The Joneses" },
    });
    expect(renamed.status).toBe(200);
    const me = await call(householdRoute.GET, "/api/household", { cookie: owner });
    expect(me.json.household).toMatchObject({ name: "The Joneses" });
  });
});

describe("member roles (spec 041 — multiple owners)", () => {
  async function meId(cookie: string) {
    const me = await call(householdRoute.GET, "/api/household", { cookie });
    return (me.json.me as { id: string }).id;
  }

  async function roleOf(cookie: string, userId: string) {
    const members = await call(membersRoute.GET, "/api/members", { cookie });
    return (members.json.members as { userId: string; role: string }[]).find(
      (m) => m.userId === userId,
    )?.role;
  }

  it("lets an owner promote a member to owner", async () => {
    const owner = await setupOwner();
    const { cookie, userId } = await joinAsMember(owner);
    expect(await roleOf(owner, userId)).toBe("member");

    const promoted = await call(memberRoute.PATCH, `/api/members/${userId}`, {
      method: "PATCH",
      cookie: owner,
      params: { userId },
      body: { role: "owner" },
    });
    expect(promoted.status).toBe(204);
    expect(await roleOf(owner, userId)).toBe("owner");

    // Full owner parity, immediately — no other code needed to learn about
    // the new owner (spec 041): they can now invite, an owner-only action.
    const created = await call(invitesRoute.POST, "/api/invites", { method: "POST", cookie });
    expect(created.status).toBe(201);
  });

  it("lets an owner demote another owner back to member", async () => {
    const owner = await setupOwner();
    const { userId } = await joinAsMember(owner);
    await call(memberRoute.PATCH, `/api/members/${userId}`, {
      method: "PATCH", cookie: owner, params: { userId }, body: { role: "owner" },
    });

    const demoted = await call(memberRoute.PATCH, `/api/members/${userId}`, {
      method: "PATCH", cookie: owner, params: { userId }, body: { role: "member" },
    });
    expect(demoted.status).toBe(204);
    expect(await roleOf(owner, userId)).toBe("member");
  });

  it("lets an owner demote themselves if another owner exists", async () => {
    const owner = await setupOwner();
    const ownerId = await meId(owner);
    const { cookie: memberCookie, userId: memberId } = await joinAsMember(owner);
    await call(memberRoute.PATCH, `/api/members/${memberId}`, {
      method: "PATCH", cookie: owner, params: { userId: memberId }, body: { role: "owner" },
    });

    const selfDemote = await call(memberRoute.PATCH, `/api/members/${ownerId}`, {
      method: "PATCH", cookie: owner, params: { userId: ownerId }, body: { role: "member" },
    });
    expect(selfDemote.status).toBe(204);

    // The original owner immediately loses owner-only access...
    expect((await call(invitesRoute.POST, "/api/invites", { method: "POST", cookie: owner })).status).toBe(403);
    // ...while the newly promoted owner has it.
    expect((await call(invitesRoute.POST, "/api/invites", { method: "POST", cookie: memberCookie })).status).toBe(201);
  });

  it("never lets the last owner be demoted", async () => {
    const owner = await setupOwner();
    const ownerId = await meId(owner);
    const attempt = await call(memberRoute.PATCH, `/api/members/${ownerId}`, {
      method: "PATCH", cookie: owner, params: { userId: ownerId }, body: { role: "member" },
    });
    expect(attempt.status).toBe(409);
    expect(await roleOf(owner, ownerId)).toBe("owner");
  });

  it("rejects a member changing any role, including their own", async () => {
    const owner = await setupOwner();
    const ownerId = await meId(owner);
    const { cookie: memberCookie, userId: memberId } = await joinAsMember(owner);

    const selfPromote = await call(memberRoute.PATCH, `/api/members/${memberId}`, {
      method: "PATCH", cookie: memberCookie, params: { userId: memberId }, body: { role: "owner" },
    });
    expect(selfPromote.status).toBe(403);

    const demoteOwner = await call(memberRoute.PATCH, `/api/members/${ownerId}`, {
      method: "PATCH", cookie: memberCookie, params: { userId: ownerId }, body: { role: "member" },
    });
    expect(demoteOwner.status).toBe(403);
  });

  it("validates the role body", async () => {
    const owner = await setupOwner();
    const { userId } = await joinAsMember(owner);
    const bad = await call(memberRoute.PATCH, `/api/members/${userId}`, {
      method: "PATCH", cookie: owner, params: { userId }, body: { role: "admin" },
    });
    expect(bad.status).toBe(400);
    const missing = await call(memberRoute.PATCH, `/api/members/${userId}`, {
      method: "PATCH", cookie: owner, params: { userId }, body: {},
    });
    expect(missing.status).toBe(400);
  });

  it("404s promoting an unknown member", async () => {
    const owner = await setupOwner();
    const missing = "00000000-0000-0000-0000-000000000000";
    const attempt = await call(memberRoute.PATCH, `/api/members/${missing}`, {
      method: "PATCH", cookie: owner, params: { userId: missing }, body: { role: "owner" },
    });
    expect(attempt.status).toBe(404);
  });

});
