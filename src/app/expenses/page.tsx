import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ExpenseLog from "@/components/ExpenseLog";
import MonthNav from "@/components/MonthNav";
import { getBudget } from "@/lib/budgets";
import { getExpensesMonth } from "@/lib/expenses";
import { getHouseholdContext } from "@/lib/household";
import { currentMonth, isMonth } from "@/lib/months";

export const dynamic = "force-dynamic";

// What actually left the household this month, logged by hand (spec 019).
// Expenses are facts, not plans: past dates are fine, the page is its own
// top-level destination (not a Plan tab), and the numbers feed the
// budget-vs-actual comparison on Overview (spec 021).
export default async function ExpensesPage(props: PageProps<"/expenses">) {
  const ctx = await getHouseholdContext(await headers());
  if (!ctx) redirect("/sign-in");

  const requested = (await props.searchParams).month;
  const now = currentMonth();
  const month =
    typeof requested === "string" && isMonth(requested) ? requested : now;

  const [budget, monthExpenses] = await Promise.all([
    getBudget(ctx, month),
    getExpensesMonth(ctx, month),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Expenses
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            What you spent
          </h1>
          <p className="text-sm text-muted">
            Log every purchase, or just the big ones — as detailed or as
            rough as you want, the app works either way.
          </p>
        </div>
        <MonthNav basePath="/expenses" month={month} now={now} />
      </div>

      {/* Remounted whenever the month or list changes so local state resets. */}
      <ExpenseLog
        key={JSON.stringify([month, monthExpenses.expenses.length])}
        month={month}
        currency={ctx.household.currency}
        categories={budget.categories.map((c) => ({ id: c.id, name: c.name }))}
        expenses={monthExpenses.expenses}
      />
    </main>
  );
}
