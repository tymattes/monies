import { redirect } from "next/navigation";
import AuthCard from "@/components/AuthCard";
import SetupChoice from "@/components/SetupChoice";
import { isSetupNeeded } from "@/lib/setup";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (!(await isSetupNeeded())) redirect("/sign-in");
  return (
    <AuthCard
      title="Set up Monies"
      description="Create your household and the first account, or restore a backup from a previous instance."
    >
      <SetupChoice />
    </AuthCard>
  );
}
