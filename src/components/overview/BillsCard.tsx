import Link from "next/link";
import { formatMoney } from "@/lib/money";
import type { Overview } from "@/lib/overview";
import { secondaryButtonCls } from "../ui";
import { pctOf } from "./MiniBar";

// Categories are an arbitrary-length list, so they share one hue at
// descending opacity (cycled by index) rather than distinct chart colors —
// same approach as Income's per-member bar. Tailwind's scanner needs these
// as literal strings (see GoalsCard).
const CATEGORY_COLORS = [
  "bg-chart-1",
  "bg-chart-1/80",
  "bg-chart-1/60",
  "bg-chart-1/40",
  "bg-chart-1/20",
] as const;

export default function BillsCard({
  bills,
  currency,
  href,
}: {
  bills: Overview["bills"];
  currency: string;
  href: string;
}) {
  const money = (c: number) => formatMoney(c, currency);
  return (
    <section aria-labelledby="bills-heading" className="space-y-3 rounded-xl border border-border bg-background shadow-sm p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="bills-heading" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-chart-1" />
          Bills
        </h2>
        <Link href={href} className={`${secondaryButtonCls} inline-block`}>
          Add bill
        </Link>
      </div>
      {bills.largest.length === 0 ? (
        <p className="text-sm text-muted">No recurring bills yet.</p>
      ) : (
        <>
          <p className="text-2xl font-semibold">
            {money(bills.totalCents)}
            <span className="text-sm font-normal text-muted"> / month</span>
          </p>
          <div>
            <h3 className="mb-1 text-xs text-muted">By category</h3>
            <div
              role="img"
              aria-label={`Bills by category: ${bills.byCategory
                .map(
                  (c) =>
                    `${c.name} ${money(c.totalCents)}, ${pctOf(c.totalCents, bills.totalCents).toFixed(1)}%`,
                )
                .join(", ")}`}
              className="mb-2 flex h-2 w-full overflow-hidden rounded-full bg-surface-subtle"
            >
              {bills.byCategory.map((c, i) => (
                <div
                  key={c.categoryId}
                  className={`h-full border-r border-background last:border-r-0 ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}`}
                  style={{ width: `${pctOf(c.totalCents, bills.totalCents)}%` }}
                />
              ))}
            </div>
            <ul className="space-y-1.5 text-sm">
              {bills.byCategory.map((c, i) => (
                <li key={c.categoryId} className="flex justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={`h-2.5 w-2.5 shrink-0 rounded-sm ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}`}
                    />
                    <span className="min-w-0 truncate">{c.name}</span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    {money(c.totalCents)}
                    <span className="block text-xs text-muted">
                      {pctOf(c.totalCents, bills.totalCents).toFixed(1)}%
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-1 text-xs text-muted">Largest</h3>
            <ul className="space-y-1.5 text-sm">
              {bills.largest.map((b) => (
                <li key={b.id} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {b.name}
                    <span className="text-muted"> · {b.categoryName}</span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    {money(b.monthlyCents)}
                    {b.intervalMonths !== 1 && (
                      <span className="block text-xs text-muted">
                        {money(b.amountCents)} every {b.intervalMonths === 12 ? "year" : `${b.intervalMonths} months`}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
