import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AuthCard from "@/components/AuthCard";
import CredentialsForm from "@/components/CredentialsForm";
import { getHouseholdContext } from "@/lib/household";
import { isSetupNeeded } from "@/lib/setup";

export const dynamic = "force-dynamic";

export default async function SignInPage(props: PageProps<"/sign-in">) {
  if (await isSetupNeeded()) redirect("/setup");
  if (await getHouseholdContext(await headers())) redirect("/");
  const restored = (await props.searchParams).restored === "1";
  return (
    <AuthCard
      title="Sign in"
      description={
        restored
          ? "Restore complete — sign in with any account from your backup."
          : "Welcome back to Monies."
      }
    >
      <CredentialsForm mode="sign-in" />
    </AuthCard>
  );
}
