import Link from "next/link";
import { formatMoney } from "@/lib/money";
import type { Overview } from "@/lib/overview";
import { secondaryButtonCls } from "../ui";
import { MiniBar, pctOf } from "./MiniBar";

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
  const maxMember = Math.max(0, ...income.byMember.map((m) => m.totalCents));
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
            <ul className="space-y-2 text-sm">
              {income.byMember.map((m) => (
                <li key={m.memberId ?? "former"} className="space-y-1">
                  <div className="flex justify-between gap-3">
                    <span>{m.name}</span>
                    <span className="tabular-nums">{money(m.totalCents)}</span>
                  </div>
                  <MiniBar pct={pctOf(m.totalCents, maxMember)} colorClassName="bg-accent" />
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
