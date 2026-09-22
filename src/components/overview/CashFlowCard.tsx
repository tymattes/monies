import Link from "next/link";
import { formatMoney } from "@/lib/money";
import type { Overview } from "@/lib/overview";
import { buttonCls } from "../ui";

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

// Income split into bills, the rest of the budget (further split into
// spending/saving/debt payoff once a household uses those types — spec 013),
// and money not yet assigned. A stacked bar (never a pie or gauge) with a
// legend that repeats every number, so nothing depends on color alone.
// Unallocated is drawn as a hatched gap.
export default function CashFlowCard({
  overview,
  billsTotalCents,
  monthName,
  assignHref,
}: {
  overview: Pick<Overview, "cashFlow" | "currency" | "editable" | "incomeProvisional">;
  billsTotalCents: number;
  monthName: string;
  assignHref: string;
}) {
  const { cashFlow: cf, currency, editable, incomeProvisional } = overview;
  const money = (c: number) => formatMoney(c, currency);
  const budgeted = cf.billsWithinBudgetCents + cf.restOfBudgetCents;
  const scale = Math.max(cf.incomeCents, budgeted, 1);
  const pct = (c: number) => `${(c / scale) * 100}%`;
  const over = cf.overAllocatedCents > 0;
  const billsExceedIncome = cf.leftAfterBillsCents < 0;
  // Variable income may still arrive, so a shortfall is shown plainly rather
  // than as an error (spec 010).
  const overIsError = over && !incomeProvisional;
  const billsIsError = billsExceedIncome && !incomeProvisional;
  const overWord = incomeProvisional ? "above recorded income" : "over-allocated";

  // The non-bill part of the budget splits into spending/saving/debt payoff
  // only once there is actually money to show there — a saving category
  // fully consumed by its own bill has nothing left to draw here (that
  // money is already inside "bills within budget"). Otherwise the bar keeps
  // its original two-segment shape and label, unchanged for the common case
  // of a household that has not used these types.
  const showType = cf.restSavingCents > 0 || cf.restDebtPayoffCents > 0;

  const summary = showType
    ? `Income ${money(cf.incomeCents)}: ${money(cf.billsWithinBudgetCents)} bills within budget, ` +
      `${money(cf.restSpendingCents)} spending` +
      (cf.restSavingCents > 0 ? `, ${money(cf.restSavingCents)} saving` : "") +
      (cf.restDebtPayoffCents > 0 ? `, ${money(cf.restDebtPayoffCents)} debt payoff` : "") +
      `, ${money(cf.unallocatedCents)} unallocated` +
      (over ? `, ${overWord} by ${money(cf.overAllocatedCents)}` : "")
    : `Income ${money(cf.incomeCents)}: ${money(cf.billsWithinBudgetCents)} bills within budget, ` +
      `${money(cf.restOfBudgetCents)} rest of budget, ${money(cf.unallocatedCents)} unallocated` +
      (over ? `, ${overWord} by ${money(cf.overAllocatedCents)}` : "");

  return (
    <section aria-labelledby="cash-flow-heading" className="space-y-4 rounded-xl border border-border bg-background shadow-sm p-5">
      <h2 id="cash-flow-heading" className="text-lg font-semibold tracking-tight">
        Cash flow in {monthName}
      </h2>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat
          label="Income (take-home)"
          value={money(cf.incomeCents)}
          note={incomeProvisional ? "Variable income counts once you record it." : undefined}
        />
        <Stat label="Bills" value={money(billsTotalCents)} />
        <Stat
          label={
            billsExceedIncome
              ? incomeProvisional
                ? "Bills exceed recorded income by"
                : "Bills exceed income by"
              : "Left after bills"
          }
          value={money(Math.abs(cf.leftAfterBillsCents))}
          danger={billsIsError}
        />
        <Stat
          label={
            over
              ? incomeProvisional
                ? "Over recorded income by"
                : "Over-allocated by"
              : "Unallocated"
          }
          value={money(over ? cf.overAllocatedCents : cf.unallocatedCents)}
          danger={overIsError}
        >
          {editable && cf.unallocatedCents > 0 && (
            <Link href={assignHref} className={`${buttonCls} mt-2 inline-block`}>
              Assign
            </Link>
          )}
        </Stat>
        {/* Full per-type totals, including any bills (spec 013) — a different,
            still-useful number from the bar's "rest" segments below, the same
            relationship the Bills stat already has to "bills within budget".
            Hidden when zero so a household that hasn't used the type does not
            see a permanent "$0.00" — the grid wraps these onto their own row. */}
        {cf.savingCents > 0 && <Stat label="Saving" value={money(cf.savingCents)} />}
        {cf.debtPayoffCents > 0 && (
          <Stat label="Debt payoff" value={money(cf.debtPayoffCents)} />
        )}
      </div>

      <div
        role="img"
        aria-label={summary}
        className="relative flex h-6 overflow-hidden rounded-md border border-border-strong bg-background"
      >
        <div
          className="h-full border-r-2 border-background bg-chart-1"
          style={{ width: pct(cf.billsWithinBudgetCents) }}
        />
        {showType ? (
          <>
            <div
              className="h-full border-r-2 border-background bg-chart-2"
              style={{ width: pct(cf.restSpendingCents) }}
            />
            {cf.restSavingCents > 0 && (
              <div
                className="h-full border-r-2 border-background bg-chart-3"
                style={{ width: pct(cf.restSavingCents) }}
              />
            )}
            {cf.restDebtPayoffCents > 0 && (
              <div
                className="h-full border-r-2 border-background bg-chart-4"
                style={{ width: pct(cf.restDebtPayoffCents) }}
              />
            )}
          </>
        ) : (
          <div
            className="h-full border-r-2 border-background bg-chart-2"
            style={{ width: pct(cf.restOfBudgetCents) }}
          />
        )}
        <div
          className="h-full"
          style={{
            width: pct(cf.unallocatedCents),
            backgroundImage:
              "repeating-linear-gradient(45deg, var(--border-strong) 0 2px, transparent 2px 7px)",
          }}
        />
        {over && (
          <div
            className={`absolute inset-y-0 w-0.5 ${overIsError ? "bg-danger" : "bg-foreground"}`}
            style={{ left: pct(cf.incomeCents) }}
          />
        )}
      </div>

      <ul className="grid gap-3 text-sm sm:grid-cols-3">
        <li className="flex items-start gap-2">
          <span aria-hidden="true" className="mt-1 h-3 w-3 shrink-0 rounded-sm bg-chart-1" />
          <span>
            <span className="block text-muted">Bills within budget</span>
            <span className="block font-medium tabular-nums">{money(cf.billsWithinBudgetCents)}</span>
          </span>
        </li>
        {showType ? (
          <>
            <li className="flex items-start gap-2">
              <span aria-hidden="true" className="mt-1 h-3 w-3 shrink-0 rounded-sm bg-chart-2" />
              <span>
                <span className="block text-muted">Spending</span>
                <span className="block font-medium tabular-nums">{money(cf.restSpendingCents)}</span>
              </span>
            </li>
            {cf.restSavingCents > 0 && (
              <li className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-1 h-3 w-3 shrink-0 rounded-sm bg-chart-3" />
                <span>
                  <span className="block text-muted">Saving</span>
                  <span className="block font-medium tabular-nums">{money(cf.restSavingCents)}</span>
                </span>
              </li>
            )}
            {cf.restDebtPayoffCents > 0 && (
              <li className="flex items-start gap-2">
                <span aria-hidden="true" className="mt-1 h-3 w-3 shrink-0 rounded-sm bg-chart-4" />
                <span>
                  <span className="block text-muted">Debt payoff</span>
                  <span className="block font-medium tabular-nums">{money(cf.restDebtPayoffCents)}</span>
                </span>
              </li>
            )}
          </>
        ) : (
          <li className="flex items-start gap-2">
            <span aria-hidden="true" className="mt-1 h-3 w-3 shrink-0 rounded-sm bg-chart-2" />
            <span>
              <span className="block text-muted">Rest of budget</span>
              <span className="block font-medium tabular-nums">{money(cf.restOfBudgetCents)}</span>
            </span>
          </li>
        )}
        <li className="flex items-start gap-2">
          <span
            aria-hidden="true"
            className="mt-1 h-3 w-3 shrink-0 rounded-sm border border-border-strong"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, var(--border-strong) 0 2px, transparent 2px 5px)",
            }}
          />
          <span>
            <span className="block text-muted">Unallocated</span>
            <span className="block font-medium tabular-nums">{money(cf.unallocatedCents)}</span>
          </span>
        </li>
        {over && (
          <li className={`flex items-start gap-2 sm:col-span-3 ${overIsError ? "text-danger" : ""}`}>
            <span
              aria-hidden="true"
              className={`mt-1 h-3 w-0.5 shrink-0 ${overIsError ? "bg-danger" : "bg-foreground"}`}
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
