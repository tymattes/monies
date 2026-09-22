import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AssignUnallocated from "@/components/AssignUnallocated";
import IncomeView from "@/components/IncomeView";
import PlanHeader from "@/components/PlanHeader";
import { getBudget } from "@/lib/budgets";
import { getHouseholdContext } from "@/lib/household";
import { getIncomeMonth } from "@/lib/income";
import { currentDate, currentMonth, isMonth, monthLabel } from "@/lib/months";
import { planSummaryFromBudget } from "@/lib/plan";

export const dynamic = "force-dynamic";

export default async function IncomePage(props: PageProps<"/income">) {
  const ctx = await getHouseholdContext(await headers());
  if (!ctx) redirect("/sign-in");

  const requested = (await props.searchParams).month;
  const now = currentMonth();
  const month =
    typeof requested === "string" && isMonth(requested) ? requested : now;
  const [income, budget] = await Promise.all([
    getIncomeMonth(ctx, month),
    getBudget(ctx, month),
  ]);
  const summary = planSummaryFromBudget(budget, month);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-10">
      <PlanHeader title="Income" month={month} now={now} summary={summary} />
      {/* Keyed by month so navigating resets the view's local state. */}
      <IncomeView
        key={month}
        month={month}
        monthName={monthLabel(month)}
        today={currentDate()}
        income={income}
      />
      {budget.editable && budget.unallocatedCents > 0 && (
        <AssignUnallocated
          key={budget.unallocatedCents}
          month={month}
          monthName={monthLabel(month)}
          currency={budget.currency}
          lines={budget.categories}
          goals={budget.goals}
          unallocated={budget.unallocatedCents}
        />
      )}
    </main>
  );
}
