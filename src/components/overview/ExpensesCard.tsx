import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { secondaryButtonCls } from "../ui";

export default function ExpensesCard({
  totalCents,
  currency,
  href,
}: {
  totalCents: number;
  currency: string;
  href: string;
}) {
  const money = (c: number) => formatMoney(c, currency);
  return (
    <section aria-labelledby="expenses-heading" className="space-y-3 rounded-xl border border-border bg-background shadow-sm p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="expenses-heading" className="text-lg font-semibold tracking-tight">Expenses</h2>
        <Link href={href} className={`${secondaryButtonCls} inline-block`}>
          Log expense
        </Link>
      </div>
      {totalCents === 0 ? (
        <p className="text-sm text-muted">No expenses logged this month yet.</p>
      ) : (
        <p className="text-2xl font-semibold tabular-nums">{money(totalCents)}</p>
      )}
    </section>
  );
}
