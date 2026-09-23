import { formatMoney } from "@/lib/money";
import type { OverviewCategory } from "@/lib/overview";

// A compact bullet-style bar: the fill is the category's actual spend (bills +
// expenses), the vertical marker is its budget, and any part of the spend past
// the budget is drawn in the error color. The table's numbers carry the same
// information, so the bar is decorative for assistive technology.
function SpendBar({ budgeted, spent }: { budgeted: number; spent: number }) {
  const scale = Math.max(budgeted, spent, 1);
  const within = (Math.min(spent, budgeted) / scale) * 100;
  const over = (Math.max(spent - budgeted, 0) / scale) * 100;
  const marker = (budgeted / scale) * 100;
  return (
    <div
      aria-hidden="true"
      className="relative h-2.5 w-40 rounded-sm border border-border-strong bg-background"
    >
      <div className="absolute inset-y-0 left-0 bg-chart-1" style={{ width: `${within}%` }} />
      {over > 0 && (
        <div
          className="absolute inset-y-0 bg-danger"
          style={{ left: `${within}%`, width: `${over}%` }}
        />
      )}
      {budgeted > 0 && (
        <div
          className="absolute -inset-y-1 w-0.5 bg-foreground"
          style={{ left: `calc(${marker}% - 1px)` }}
        />
      )}
    </div>
  );
}

export default function CategoryTable({
  rows,
  currency,
}: {
  rows: OverviewCategory[];
  currency: string;
}) {
  const money = (c: number) => formatMoney(c, currency);
  const totals = rows.reduce(
    (t, r) => ({
      budgeted: t.budgeted + r.budgetedCents,
      bills: t.bills + r.billsCents,
      expenses: t.expenses + r.expensesCents,
    }),
    { budgeted: 0, bills: 0, expenses: 0 },
  );

  return (
    <section aria-labelledby="categories-heading" className="space-y-2">
      <h2 id="categories-heading" className="text-lg font-semibold tracking-tight">
        Categories
      </h2>
      <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Budget by category: budgeted, bills, expenses, and what is left of the budget
          </caption>
          <thead>
            <tr className="border-b border-border bg-surface-subtle text-xs text-muted">
              <th scope="col" className="px-4 py-2 text-left font-normal">Category</th>
              <th scope="col" className="hidden px-2 py-2 text-right font-normal sm:table-cell">Budgeted</th>
              <th scope="col" className="hidden px-2 py-2 text-right font-normal sm:table-cell">Bills</th>
              <th scope="col" className="hidden px-2 py-2 text-right font-normal sm:table-cell">Expenses</th>
              <th scope="col" className="px-2 py-2 text-right font-normal">Left</th>
              <th scope="col" className="hidden py-2 pl-2 pr-4 text-left font-normal sm:table-cell">
                <span className="sr-only">Spend against budget</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <th scope="row" className="px-4 py-3 text-left font-medium">
                  {r.name}
                  <span className="block text-xs font-normal text-muted sm:hidden">
                    Budgeted {money(r.budgetedCents)} · Bills {money(r.billsCents)} · Expenses {money(r.expensesCents)}
                  </span>
                </th>
                <td className="hidden px-2 py-3 text-right tabular-nums sm:table-cell">
                  {money(r.budgetedCents)}
                </td>
                <td className="hidden px-2 py-3 text-right tabular-nums text-muted sm:table-cell">
                  {money(r.billsCents)}
                </td>
                <td className="hidden px-2 py-3 text-right tabular-nums text-muted sm:table-cell">
                  {money(r.expensesCents)}
                </td>
                <td
                  className={`px-2 py-3 text-right tabular-nums ${
                    r.leftCents < 0 ? "text-danger" : ""
                  }`}
                >
                  {money(r.leftCents)}
                </td>
                <td className="hidden py-3 pl-2 pr-4 sm:table-cell">
                  <SpendBar budgeted={r.budgetedCents} spent={r.billsCents + r.expensesCents} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-surface font-semibold">
              <th scope="row" className="px-4 py-3 text-left">Total</th>
              <td className="hidden px-2 py-3 text-right tabular-nums sm:table-cell">{money(totals.budgeted)}</td>
              <td className="hidden px-2 py-3 text-right tabular-nums sm:table-cell">{money(totals.bills)}</td>
              <td className="hidden px-2 py-3 text-right tabular-nums sm:table-cell">{money(totals.expenses)}</td>
              <td className="px-2 py-3 text-right tabular-nums">{money(totals.budgeted - totals.bills - totals.expenses)}</td>
              <td className="hidden sm:table-cell" />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-muted">
        The bar shows what a category has actually spent — bills plus logged
        expenses — against its budget (the vertical line).
      </p>
    </section>
  );
}
