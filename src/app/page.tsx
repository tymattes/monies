import { headers } from "next/headers";
import { redirect } from "next/navigation";
import MonthNav from "@/components/MonthNav";
import BillsCard from "@/components/overview/BillsCard";
import CashFlowCard from "@/components/overview/CashFlowCard";
import CategoryTable from "@/components/overview/CategoryTable";
import ExpensesList from "@/components/overview/ExpensesList";
import GetStarted from "@/components/overview/GetStarted";
import GoalsCard from "@/components/overview/GoalsCard";
import IncomeCard from "@/components/overview/IncomeCard";
import TaskList from "@/components/overview/TaskList";
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

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            {o.householdName}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Hub</h1>
          <p className="text-sm text-muted">
            How this month is going, and what still needs doing.
          </p>
        </div>
        <MonthNav basePath="/" month={month} now={now} />
      </div>

      {o.editable && <GetStarted overview={o} query={q} />}
      {/* Remounted whenever the month or tasks change so expand state never
          carries over into a different month's tasks (spec 035). */}
      <TaskList
        key={JSON.stringify([month, o.tasks.length])}
        items={o.tasks}
        month={month}
        currency={o.currency}
        editable={o.editable}
        categories={o.categories}
        goals={o.goals}
      />
      <CashFlowCard overview={o} monthName={monthLabel(month)} />
      {o.categories.length > 0 && (
        <CategoryTable rows={o.categories} currency={o.currency} editHref={`/budget${q}`} />
      )}
      <ExpensesList
        expenses={o.expenses}
        totalCents={o.cashFlow.expensesCents}
        currency={o.currency}
        href={`/expenses${q}`}
      />
      <div className="grid items-start gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <IncomeCard income={o.income} currency={o.currency} href={`/income${q}`} />
        <BillsCard bills={o.bills} currency={o.currency} href={`/bills${q}`} />
        <GoalsCard goals={o.goals} currency={o.currency} href={`/goals${q}`} />
      </div>
    </main>
  );
}
