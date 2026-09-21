import Link from "next/link";
import AuthCard from "@/components/AuthCard";
import CredentialsForm from "@/components/CredentialsForm";
import { INVITE_MESSAGES, lookupInvite } from "@/lib/invites";

export const dynamic = "force-dynamic";

export default async function JoinPage(props: PageProps<"/join/[token]">) {
  const { token } = await props.params;
  const { status, householdName } = await lookupInvite(token);

  if (status !== "valid") {
    return (
      <AuthCard title="Invite unavailable" description={INVITE_MESSAGES[status]}>
        <p className="text-sm text-muted">
          Ask a household owner for a new link, or{" "}
          <Link href="/sign-in" className="underline">
            sign in
          </Link>{" "}
          if you already have an account.
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={`Join ${householdName}`}
      description="Create your account to join this household."
    >
      <CredentialsForm mode="join" token={token} />
    </AuthCard>
  );
}
