import Link from "next/link";
import { dayLabel } from "@/lib/months";
import { formatMoney } from "@/lib/money";
import type { Overview } from "@/lib/overview";
import type { ExpenseLine } from "@/lib/expenses";
import { secondaryButtonCls } from "../ui";

// A full-width ledger at the bottom of Overview (spec 034), replacing the old
// totals-only card: the month's actual logged expenses, newest first and
// grouped by day. `expenses.recent` is already capped server-side
// (getOverview); `expenses.count` says whether more exist so "View all" only
// shows when it's true. `totalCents` comes from cashFlow.expensesCents, never
// resummed from the (possibly capped) rows. The section itself is the card
// (background, border, padding), same as CashFlowCard and the other Overview
// cards — not split into a bare heading plus an inner card like the Budget
// table, so it still reads as one of the page's raised panels (spec 011).
export default function ExpensesList({
  expenses,
  totalCents,
  currency,
  href,
}: {
  expenses: Overview["expenses"];
  totalCents: number;
  currency: string;
  href: string;
}) {
  const money = (c: number) => formatMoney(c, currency);
  const { recent, count } = expenses;

  const groups: { date: string; rows: ExpenseLine[] }[] = [];
  for (const row of recent) {
    const current = groups.at(-1);
    if (current && current.date === row.spentOn) current.rows.push(row);
    else groups.push({ date: row.spentOn, rows: [row] });
  }

  return (
    <section aria-labelledby="expenses-heading" className="space-y-3 rounded-xl border border-border bg-background shadow-sm p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="expenses-heading" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-chart-2" />
          Expenses
        </h2>
        <Link href={href} className={`${secondaryButtonCls} inline-block`}>
          Log expense
        </Link>
      </div>
      {recent.length === 0 ? (
        <p className="text-sm text-muted">No expenses logged this month yet.</p>
      ) : (
        <>
          <ul className="divide-y divide-dashed divide-border text-sm">
            {groups.map((g) => (
              <li key={g.date} className="py-3 first:pt-0 last:pb-0">
                <p className="mb-2 text-xs text-muted">{dayLabel(g.date)}</p>
                <ul className="space-y-2">
                  {g.rows.map((x) => (
                    <li key={x.id} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate">
                        {x.categoryName}
                        {x.description && <span className="text-muted"> · {x.description}</span>}
                      </span>
                      <span className="shrink-0 tabular-nums">{money(x.amountCents)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          {count > recent.length && (
            <div className="flex justify-center">
              <Link href={href} className={`${secondaryButtonCls} inline-block`}>
                View all in Expenses
              </Link>
            </div>
          )}
          <div className="flex justify-between rounded-lg bg-surface px-4 py-3 text-sm font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{money(totalCents)}</span>
          </div>
        </>
      )}
    </section>
  );
}
