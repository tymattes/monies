import { headers } from "next/headers";
import { redirect } from "next/navigation";
import IncomeView from "@/components/IncomeView";
import MonthNav from "@/components/MonthNav";
import { getHouseholdContext } from "@/lib/household";
import { getIncomeMonth } from "@/lib/income";
import { currentDate, currentMonth, isMonth, monthLabel } from "@/lib/months";

export const dynamic = "force-dynamic";

export default async function IncomePage(props: PageProps<"/income">) {
  const ctx = await getHouseholdContext(await headers());
  if (!ctx) redirect("/sign-in");

  const requested = (await props.searchParams).month;
  const now = currentMonth();
  const month =
    typeof requested === "string" && isMonth(requested) ? requested : now;
  const income = await getIncomeMonth(ctx, month);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Income</h1>
        <MonthNav basePath="/income" month={month} now={now} />
      </div>
      {/* Keyed by month so navigating resets the view's local state. */}
      <IncomeView
        key={month}
        month={month}
        monthName={monthLabel(month)}
        today={currentDate()}
        income={income}
      />
    </main>
  );
}
