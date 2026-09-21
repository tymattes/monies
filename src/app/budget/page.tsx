import { headers } from "next/headers";
import { redirect } from "next/navigation";
import BudgetEditor from "@/components/BudgetEditor";
import CategoryManager from "@/components/CategoryManager";
import PlanHeader from "@/components/PlanHeader";
import { getBudget } from "@/lib/budgets";
import { listCategories } from "@/lib/categories";
import { getHouseholdContext } from "@/lib/household";
import { currentMonth, isMonth, monthLabel } from "@/lib/months";

export const dynamic = "force-dynamic";

export default async function BudgetPage(props: PageProps<"/budget">) {
  const ctx = await getHouseholdContext(await headers());
  if (!ctx) redirect("/sign-in");

  const requested = (await props.searchParams).month;
  const now = currentMonth();
  const month =
    typeof requested === "string" && isMonth(requested) ? requested : now;

  const [budget, all] = await Promise.all([
    getBudget(ctx, month),
    listCategories(ctx.household.id),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-10 px-4 py-10">
      <section className="space-y-4">
        <PlanHeader title="Budget" month={month} now={now} />
        {/* Remounted when the server data changes (month, income, categories,
            amounts) so the editor's local state never goes stale. */}
        <BudgetEditor
          key={JSON.stringify([month, budget.incomeCents, budget.categories])}
          month={month}
          monthName={monthLabel(month)}
          currency={budget.currency}
          editable={budget.editable}
          lines={budget.categories}
          incomeCents={budget.incomeCents}
          incomeProvisional={budget.incomeProvisional}
          billsTotalCents={budget.billsTotalCents}
        />
      </section>

      <CategoryManager
        categories={all.map((c) => ({
          id: c.id,
          name: c.name,
          archived: c.archivedFrom !== null,
        }))}
      />
    </main>
  );
}
