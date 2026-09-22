import { headers } from "next/headers";
import { redirect } from "next/navigation";
import GoalEditor from "@/components/GoalEditor";
import GoalManager from "@/components/GoalManager";
import MonthNav from "@/components/MonthNav";
import { getGoalsMonth, listGoals } from "@/lib/goals";
import { getHouseholdContext } from "@/lib/household";
import { currentMonth, isMonth } from "@/lib/months";

export const dynamic = "force-dynamic";

// Not a Plan tab (spec 014): Saving and Debt payoff goals are deliberately
// separate from the Budget/Bills/Income group, since they track money that
// happens outside this app entirely.
export default async function GoalsPage(props: PageProps<"/goals">) {
  const ctx = await getHouseholdContext(await headers());
  if (!ctx) redirect("/sign-in");

  const requested = (await props.searchParams).month;
  const now = currentMonth();
  const month =
    typeof requested === "string" && isMonth(requested) ? requested : now;

  const [data, all] = await Promise.all([
    getGoalsMonth(ctx, month),
    listGoals(ctx.household.id),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-10 px-4 py-10">
      <section className="space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Goals</h1>
          <MonthNav basePath="/goals" month={month} now={now} />
        </header>
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
          archived: g.archivedFrom !== null,
        }))}
      />
    </main>
  );
}
