import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getHouseholdContext } from "@/lib/household";

export const dynamic = "force-dynamic";

export default async function Home() {
  const ctx = await getHouseholdContext(await headers());
  if (!ctx) redirect("/sign-in");
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">
        {ctx.household.name}
      </h1>
      <p className="mt-2 text-sm text-muted">
        Welcome back, {ctx.user.name}.
      </p>
    </main>
  );
}
