import Link from "next/link";
import { formatMoney } from "@/lib/money";
import type { Overview } from "@/lib/overview";
import { secondaryButtonCls } from "../ui";
import { pctOf } from "./MiniBar";

// Members are an arbitrary-length list (unlike Fixed/Variable's fixed two),
// so they share one hue at descending opacity rather than distinct chart
// colors — cycled by index. Tailwind's scanner needs these as literal
// strings (see GoalsCard).
const MEMBER_COLORS = ["bg-accent", "bg-accent/70", "bg-accent/45", "bg-accent/25"] as const;

export default function IncomeCard({
  income,
  currency,
  href,
}: {
  income: Overview["income"];
  currency: string;
  href: string;
}) {
  const money = (c: number) => formatMoney(c, currency);
  return (
    <section aria-labelledby="income-heading" className="space-y-3 rounded-xl border border-border bg-background shadow-sm p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="income-heading" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
          Income
        </h2>
        <Link href={href} className={`${secondaryButtonCls} inline-block`}>
          Add income
        </Link>
      </div>
      {income.totalCents === 0 ? (
        <p className="text-sm text-muted">No income recorded for this month yet.</p>
      ) : (
        <>
          <p className="text-2xl font-semibold">{money(income.totalCents)}</p>
          <div
            aria-hidden="true"
            className="flex h-2 w-full overflow-hidden rounded-full bg-surface-subtle"
          >
            <div
              className="h-full bg-accent"
              style={{ width: `${pctOf(income.fixedCents, income.totalCents)}%` }}
            />
            <div
              className="h-full bg-accent/40"
              style={{ width: `${pctOf(income.variableCents, income.totalCents)}%` }}
            />
          </div>
          <dl className="space-y-1 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-muted">
                <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm bg-accent" />
                Fixed monthly
              </dt>
              <dd className="tabular-nums">{money(income.fixedCents)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-muted">
                <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm bg-accent/40" />
                Variable (deposits)
              </dt>
              <dd className="tabular-nums">{money(income.variableCents)}</dd>
            </div>
          </dl>
          <div>
            <h3 className="mb-1 text-xs text-muted">By member</h3>
            <dl className="space-y-1 text-sm">
              {income.byMember.map((m, i) => (
                <div key={m.memberId ?? "former"} className="flex items-center justify-between gap-3">
                  <dt className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={`h-2.5 w-2.5 shrink-0 rounded-sm ${MEMBER_COLORS[i % MEMBER_COLORS.length]}`}
                    />
                    <span className="min-w-0 truncate">{m.name}</span>
                  </dt>
                  <dd className="text-right tabular-nums">
                    {money(m.totalCents)}
                    <span className="block text-xs text-muted">
                      {pctOf(m.totalCents, income.totalCents).toFixed(1)}%
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </>
      )}
    </section>
  );
}
