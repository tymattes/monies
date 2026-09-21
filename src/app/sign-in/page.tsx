import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AuthCard from "@/components/AuthCard";
import CredentialsForm from "@/components/CredentialsForm";
import { getHouseholdContext } from "@/lib/household";
import { isSetupNeeded } from "@/lib/setup";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (await isSetupNeeded()) redirect("/setup");
  if (await getHouseholdContext(await headers())) redirect("/");
  return (
    <AuthCard title="Sign in" description="Welcome back to Monies.">
      <CredentialsForm mode="sign-in" />
    </AuthCard>
  );
}
