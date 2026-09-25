import { formatMoney } from "@/lib/money";
import type { Overview } from "@/lib/overview";

function Stat({
  label,
  value,
  note,
  danger,
  children,
}: {
  label: string;
  value: string;
  note?: string;
  danger?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <p className={`text-xs ${danger ? "text-danger" : "text-muted"}`}>{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${danger ? "text-danger" : ""}`}>
        {value}
      </p>
      {note && <p className="text-balance text-xs text-muted">{note}</p>}
      {children}
    </div>
  );
}

// Income split into what is actually claimed by something real (spec 021/022):
// Bills, checked-off Saving, checked-off Debt payoff, Expenses, and the
// Unallocated remainder (drawn as a hatched gap). A stacked bar (never a pie
// or gauge) with a legend that repeats every number, so nothing depends on
// color alone. The bar/legend is the only place Bills, Expenses and
// Unallocated Income appear — the headline stats above it stay to figures the
// bar can't show: take-home income and the full Saving/Debt payoff targets
// (planning figures, distinct from the bar's checked-off amount).
export default function CashFlowCard({
  overview,
  monthName,
}: {
  overview: Pick<Overview, "cashFlow" | "currency" | "incomeProvisional">;
  monthName: string;
}) {
  const { cashFlow: cf, currency, incomeProvisional } = overview;
  const money = (c: number) => formatMoney(c, currency);
  const committed =
    cf.billsCents + cf.expensesCents + cf.checkedSavingCents + cf.checkedDebtPayoffCents;
  const scale = Math.max(cf.incomeCents, committed, 1);
  const pct = (c: number) => `${(c / scale) * 100}%`;
  const over = cf.overAllocatedCents > 0;
  // Variable income may still arrive, so a shortfall is shown plainly rather
  // than as an error (spec 010).
  const overIsError = over && !incomeProvisional;
  const overWord = incomeProvisional ? "above recorded income" : "over-allocated";

  const segments = [
    { key: "bills", label: "Bills", cents: cf.billsCents, cls: "bg-chart-1" },
    ...(cf.checkedSavingCents > 0
      ? [{ key: "saving", label: "Saving", cents: cf.checkedSavingCents, cls: "bg-chart-3" }]
      : []),
    ...(cf.checkedDebtPayoffCents > 0
      ? [{ key: "debt", label: "Debt payoff", cents: cf.checkedDebtPayoffCents, cls: "bg-chart-4" }]
      : []),
    ...(cf.expensesCents > 0
      ? [{ key: "expenses", label: "Expenses", cents: cf.expensesCents, cls: "bg-chart-2" }]
      : []),
  ];

  const summary =
    `Income ${money(cf.incomeCents)}: ` +
    segments.map((s) => `${money(s.cents)} ${s.label.toLowerCase()}`).join(", ") +
    `, ${money(cf.unallocatedCents)} unallocated income` +
    (over ? `, ${overWord} by ${money(cf.overAllocatedCents)}` : "");

  // Same convention as the Budget table's per-category SpendBar: the part of
  // the bar past the income line is drawn in the error color regardless of
  // which segment(s) it came from, rather than letting Bills/Saving/etc. hues
  // run past what income actually covers.
  let cumCents = 0;
  const barSegments = segments.map((s) => {
    const start = cumCents;
    cumCents += s.cents;
    const visibleCents = Math.max(0, Math.min(cumCents, cf.incomeCents) - start);
    return { ...s, visibleCents };
  });

  return (
    <section aria-labelledby="cash-flow-heading" className="space-y-4 rounded-xl border border-border bg-background shadow-sm p-5">
      <h2 id="cash-flow-heading" className="text-lg font-semibold tracking-tight">
        Cash flow in {monthName}
      </h2>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat
          label="Income (take-home)"
          value={money(cf.incomeCents)}
          note={incomeProvisional ? "Variable income counts once you record it." : undefined}
        />
        {/* Full per-type goal targets (spec 013) — a planning figure, distinct
            from the bar's checked segments below. Hidden when zero so a
            household that hasn't used the type does not see a permanent
            "$0.00". */}
        {cf.savingCents > 0 && <Stat label="Saving goal" value={money(cf.savingCents)} />}
        {cf.debtPayoffCents > 0 && (
          <Stat label="Debt payoff goal" value={money(cf.debtPayoffCents)} />
        )}
      </div>

      <div
        role="img"
        aria-label={summary}
        className="relative flex h-6 overflow-hidden rounded-md border border-border-strong bg-background"
      >
        {barSegments.map((s) => (
          <div
            key={s.key}
            className={`h-full ${s.visibleCents > 0 ? "border-r-2 border-background" : ""} ${s.cls}`}
            style={{ width: pct(s.visibleCents) }}
            aria-hidden="true"
          />
        ))}
        {over && (
          <div
            aria-hidden="true"
            className={`h-full ${overIsError ? "bg-danger" : "bg-foreground"}`}
            style={{ width: pct(cf.overAllocatedCents) }}
          />
        )}
        <div
          aria-hidden="true"
          className="h-full"
          style={{
            width: pct(cf.unallocatedCents),
            backgroundImage:
              "repeating-linear-gradient(45deg, var(--accent) 0 2px, transparent 2px 7px)",
          }}
        />
      </div>

      <ul className="grid gap-3 text-sm sm:grid-cols-4">
        {segments.map((s) => (
          <li key={s.key} className="flex items-start gap-2">
            <span aria-hidden="true" className={`mt-1 h-3 w-3 shrink-0 rounded-sm ${s.cls}`} />
            <span>
              <span className="block text-muted">{s.label}</span>
              <span className="block font-medium tabular-nums">{money(s.cents)}</span>
            </span>
          </li>
        ))}
        <li className="flex items-start gap-2">
          <span
            aria-hidden="true"
            className="mt-1 h-3 w-3 shrink-0 rounded-sm border border-accent"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, var(--accent) 0 2px, transparent 2px 5px)",
            }}
          />
          <span>
            <span className="block text-muted">Unallocated Income</span>
            <span className="block font-medium tabular-nums">{money(cf.unallocatedCents)}</span>
          </span>
        </li>
        {over && (
          <li className={`flex items-start gap-2 sm:col-span-4 ${overIsError ? "text-danger" : ""}`}>
            <span
              aria-hidden="true"
              className={`mt-1 h-3 w-3 shrink-0 rounded-sm ${overIsError ? "bg-danger" : "bg-foreground"}`}
            />
            <span>
              <span className="block">
                {incomeProvisional
                  ? "Above recorded income (past the income line)"
                  : "Over-allocated (past the income line)"}
              </span>
              <span className="block font-medium tabular-nums">{money(cf.overAllocatedCents)}</span>
            </span>
          </li>
        )}
      </ul>
    </section>
  );
}
