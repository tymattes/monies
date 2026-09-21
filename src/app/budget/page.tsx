import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import BudgetEditor from "@/components/BudgetEditor";
import CategoryManager from "@/components/CategoryManager";
import { getBudget } from "@/lib/budgets";
import { listCategories } from "@/lib/categories";
import { getHouseholdContext } from "@/lib/household";
import { addMonths, currentMonth, isMonth, monthLabel } from "@/lib/months";

export const dynamic = "force-dynamic";

const navCls =
  "rounded-md border border-foreground/20 px-3 py-1.5 text-sm hover:bg-foreground/5";

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Budget</h1>
          <nav aria-label="Month" className="flex items-center gap-2">
            <Link
              href={`/budget?month=${addMonths(month, -1)}`}
              className={navCls}
              aria-label="Previous month"
            >
              ←
            </Link>
            <span className="min-w-36 text-center text-sm font-medium">
              {monthLabel(month)}
            </span>
            <Link
              href={`/budget?month=${addMonths(month, 1)}`}
              className={navCls}
              aria-label="Next month"
            >
              →
            </Link>
            {month !== now && (
              <Link href="/budget" className={navCls}>
                This month
              </Link>
            )}
          </nav>
        </div>
        {/* Keyed by month so navigating resets the editor's local state. */}
        <BudgetEditor
          key={month}
          month={month}
          monthName={monthLabel(month)}
          currency={budget.currency}
          editable={budget.editable}
          lines={budget.categories}
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
