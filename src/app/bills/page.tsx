import { headers } from "next/headers";
import { redirect } from "next/navigation";
import BillsView from "@/components/BillsView";
import PlanHeader from "@/components/PlanHeader";
import { getBillsMonth } from "@/lib/bills";
import { listCategories } from "@/lib/categories";
import { getHouseholdContext } from "@/lib/household";
import { listMembers } from "@/lib/members";
import { getPlanSummary } from "@/lib/plan";
import { currentMonth, isMonth, monthLabel } from "@/lib/months";

export const dynamic = "force-dynamic";

export default async function BillsPage(props: PageProps<"/bills">) {
  const ctx = await getHouseholdContext(await headers());
  if (!ctx) redirect("/sign-in");

  const requested = (await props.searchParams).month;
  const now = currentMonth();
  const month =
    typeof requested === "string" && isMonth(requested) ? requested : now;

  const [data, all, summary, members] = await Promise.all([
    getBillsMonth(ctx, month),
    listCategories(ctx.household.id),
    getPlanSummary(ctx, month),
    listMembers(ctx.household.id),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-10">
      <PlanHeader title="Bills" month={month} now={now} summary={summary} />
      {/* Remounted whenever the server data changes so local edit state never goes stale. */}
      <BillsView
        key={JSON.stringify([month, data.bills])}
        month={month}
        monthName={monthLabel(month)}
        startMonthName={monthLabel(now)}
        data={data}
        categories={all
          .filter((c) => c.archivedFrom === null)
          .map((c) => ({ id: c.id, name: c.name }))}
        members={members.map((m) => ({ id: m.userId, name: m.name }))}
      />
    </main>
  );
}
