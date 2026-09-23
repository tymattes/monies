import { headers } from "next/headers";
import { redirect } from "next/navigation";
import MonthNav from "@/components/MonthNav";
import AttentionList from "@/components/overview/AttentionList";
import BillsCard from "@/components/overview/BillsCard";
import CashFlowCard from "@/components/overview/CashFlowCard";
import CategoryTable from "@/components/overview/CategoryTable";
import ExpensesCard from "@/components/overview/ExpensesCard";
import GetStarted from "@/components/overview/GetStarted";
import GoalsCard from "@/components/overview/GoalsCard";
import IncomeCard from "@/components/overview/IncomeCard";
import { getHouseholdContext } from "@/lib/household";
import { currentMonth, isMonth, monthLabel } from "@/lib/months";
import { getOverview } from "@/lib/overview";

export const dynamic = "force-dynamic";

// The home page: how the month is going, read-only. Editing happens on the
// Plan pages (Budget, Bills, Income); the numbers here come from the same
// function as GET /api/overview/[month].
export default async function OverviewPage(props: PageProps<"/">) {
  const ctx = await getHouseholdContext(await headers());
  if (!ctx) redirect("/sign-in");

  const requested = (await props.searchParams).month;
  const now = currentMonth();
  const month =
    typeof requested === "string" && isMonth(requested) ? requested : now;
  const o = await getOverview(ctx, month);
  const q = month === now ? "" : `?month=${month}`;

  const empty =
    o.editable &&
    o.income.totalCents === 0 &&
    o.budget.budgetedCents === 0 &&
    o.bills.totalCents === 0;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            {o.householdName}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        </div>
        <MonthNav basePath="/" month={month} now={now} />
      </div>

      {empty ? (
        <GetStarted query={q} />
      ) : (
        <>
          <AttentionList items={o.attention} />
          <CashFlowCard
            overview={o}
            monthName={monthLabel(month)}
            assignHref={`/income${q}#assign`}
          />
          {o.categories.length > 0 && (
            <CategoryTable rows={o.categories} currency={o.currency} editHref={`/budget${q}`} />
          )}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <IncomeCard income={o.income} currency={o.currency} href={`/income${q}`} />
            <BillsCard bills={o.bills} currency={o.currency} href={`/bills${q}`} />
            <ExpensesCard
              totalCents={o.cashFlow.expensesCents}
              currency={o.currency}
              href={`/expenses${q}`}
            />
            <GoalsCard goals={o.goals} currency={o.currency} href={`/goals${q}`} />
          </div>
        </>
      )}
    </main>
  );
}
