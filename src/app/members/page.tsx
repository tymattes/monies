import { headers } from "next/headers";
import { redirect } from "next/navigation";
import HouseholdNameForm from "@/components/HouseholdNameForm";
import InviteManager from "@/components/InviteManager";
import MemberActions from "@/components/MemberActions";
import { getHouseholdContext } from "@/lib/household";
import { listPendingInvites } from "@/lib/invites";
import { listMembers } from "@/lib/members";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export default async function MembersPage() {
  const ctx = await getHouseholdContext(await headers());
  if (!ctx) redirect("/sign-in");
  const isOwner = ctx.role === "owner";
  const [members, invites] = await Promise.all([
    listMembers(ctx.household.id),
    isOwner ? listPendingInvites(ctx.household.id) : Promise.resolve([]),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-10 px-4 py-10">
      <section className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
          <p className="text-sm text-muted">
            Who&apos;s in the household, their role, and invites to join.
          </p>
        </div>
        {isOwner && <HouseholdNameForm name={ctx.household.name} />}
      </section>

      <section>
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background shadow-sm">
          {members.map((m) => (
            <li
              key={m.userId}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {m.name}
                  {m.userId === ctx.user.id && (
                    <span className="ml-2 text-xs text-muted">(you)</span>
                  )}
                </p>
                <p className="truncate text-sm text-muted">{m.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <div className="text-right text-sm">
                  <p className="capitalize">{m.role}</p>
                  <p className="text-muted">
                    Joined {dateFmt.format(m.joinedAt)}
                  </p>
                </div>
                <MemberActions
                  userId={m.userId}
                  name={m.name}
                  role={m.role}
                  isSelf={m.userId === ctx.user.id}
                  canRemove={isOwner || m.userId === ctx.user.id}
                  canChangeRole={isOwner}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {isOwner && (
        <InviteManager
          pending={invites.map((i) => ({
            id: i.id,
            createdAt: dateFmt.format(i.createdAt),
            expiresAt: dateFmt.format(i.expiresAt),
          }))}
        />
      )}
    </main>
  );
}
