import Link from "next/link";
import { formatMoney } from "@/lib/money";
import type { Overview } from "@/lib/overview";
import { secondaryButtonCls } from "../ui";
import { MiniBar, pctOf } from "./MiniBar";

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
  const maxCategory = Math.max(0, ...bills.byCategory.map((c) => c.totalCents));
  const maxLargest = Math.max(0, ...bills.largest.map((b) => b.monthlyCents));
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
            <ul className="space-y-2 text-sm">
              {bills.byCategory.map((c) => (
                <li key={c.categoryId} className="space-y-1">
                  <div className="flex justify-between gap-3">
                    <span>{c.name}</span>
                    <span className="tabular-nums">{money(c.totalCents)}</span>
                  </div>
                  <MiniBar pct={pctOf(c.totalCents, maxCategory)} colorClassName="bg-chart-1" />
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-1 text-xs text-muted">Largest</h3>
            <ul className="space-y-2 text-sm">
              {bills.largest.map((b) => (
                <li key={b.id} className="space-y-1">
                  <div className="flex justify-between gap-3">
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
                  </div>
                  <MiniBar pct={pctOf(b.monthlyCents, maxLargest)} colorClassName="bg-chart-1" />
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
