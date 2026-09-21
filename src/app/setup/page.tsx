import { redirect } from "next/navigation";
import AuthCard from "@/components/AuthCard";
import CredentialsForm from "@/components/CredentialsForm";
import { isSetupNeeded } from "@/lib/setup";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (!(await isSetupNeeded())) redirect("/sign-in");
  return (
    <AuthCard
      title="Set up Monies"
      description="Create your household and the first account. You'll be its owner and can invite others afterwards."
    >
      <CredentialsForm mode="setup" />
    </AuthCard>
  );
}
