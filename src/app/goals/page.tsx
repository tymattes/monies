import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AssignUnallocated from "@/components/AssignUnallocated";
import GoalEditor from "@/components/GoalEditor";
import GoalManager from "@/components/GoalManager";
import PlanHeader from "@/components/PlanHeader";
import { getBudget } from "@/lib/budgets";
import { getGoalsMonth, listGoals } from "@/lib/goals";
import { getHouseholdContext } from "@/lib/household";
import { currentMonth, isMonth, monthLabel } from "@/lib/months";
import { planSummaryFromBudget } from "@/lib/plan";

export const dynamic = "force-dynamic";

// The 4th Plan tab (spec 015 — moved in from its own top-level destination).
export default async function GoalsPage(props: PageProps<"/goals">) {
  const ctx = await getHouseholdContext(await headers());
  if (!ctx) redirect("/sign-in");

  const requested = (await props.searchParams).month;
  const now = currentMonth();
  const month =
    typeof requested === "string" && isMonth(requested) ? requested : now;

  const [data, all, budget] = await Promise.all([
    getGoalsMonth(ctx, month),
    listGoals(ctx.household.id),
    getBudget(ctx, month),
  ]);
  const summary = planSummaryFromBudget(budget, month);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-10 px-4 py-10">
      <section className="space-y-4">
        <PlanHeader title="Goals" month={month} now={now} summary={summary} />
        {budget.editable && budget.unallocatedCents > 0 && (
          <AssignUnallocated
            key={budget.unallocatedCents}
            month={month}
            monthName={monthLabel(month)}
            currency={budget.currency}
            goals={budget.goals}
            unallocated={budget.unallocatedCents}
          />
        )}
        <p className="text-sm text-muted">
          {data.editable
            ? "Amounts apply from this month onward. The checkmark can be set for any month."
            : "Past months are read-only so history stays accurate; the checkmark can still be changed."}
        </p>
        {/* Remounted whenever the server data changes so local edit state never goes stale. */}
        <GoalEditor
          key={JSON.stringify([month, data.goals])}
          month={month}
          currency={ctx.household.currency}
          editable={data.editable}
          lines={data.goals}
        />
      </section>

      <GoalManager
        goals={all.map((g) => ({
          id: g.id,
          name: g.name,
          type: g.type,
          note: g.note,
          archived: g.archivedFrom !== null,
        }))}
      />
    </main>
  );
}
