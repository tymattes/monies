import Link from "next/link";
import { formatMoney } from "@/lib/money";
import type { Overview } from "@/lib/overview";
import { secondaryButtonCls } from "../ui";

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
        <h2 id="income-heading" className="text-lg font-semibold tracking-tight">Income</h2>
        <Link href={href} className={`${secondaryButtonCls} inline-block`}>
          Add income
        </Link>
      </div>
      {income.totalCents === 0 ? (
        <p className="text-sm text-muted">No income recorded for this month yet.</p>
      ) : (
        <>
          <p className="text-2xl font-semibold tabular-nums">{money(income.totalCents)}</p>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Fixed monthly</dt>
              <dd className="tabular-nums">{money(income.fixedCents)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Variable (deposits)</dt>
              <dd className="tabular-nums">{money(income.variableCents)}</dd>
            </div>
          </dl>
          <div>
            <h3 className="mb-1 text-xs text-muted">By member</h3>
            <ul className="space-y-1 text-sm">
              {income.byMember.map((m) => (
                <li key={m.memberId ?? "former"} className="flex justify-between gap-3">
                  <span>{m.name}</span>
                  <span className="tabular-nums">{money(m.totalCents)}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
