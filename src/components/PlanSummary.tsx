import Link from "next/link";
import { formatMoney } from "@/lib/money";
import type { PlanSummaryData } from "@/lib/plan";
import { secondaryButtonCls } from "./ui";

function Stat({
  label,
  value,
  note,
  danger,
}: {
  label: string;
  value: string;
  note?: string;
  danger?: boolean;
}) {
  return (
    <div>
      <p className={`text-xs ${danger ? "text-danger" : "text-muted"}`}>{label}</p>
      <p
        className={`text-xl font-semibold tabular-nums ${danger ? "text-danger" : ""}`}
      >
        {value}
      </p>
      {note && <p className="text-balance text-xs text-muted">{note}</p>}
    </div>
  );
}

// Income, Budgeted and Unallocated Income for the month, plus this month's
// open tasks (spec 033) — Assign among them, no longer a special-cased
// button — shown on every Plan page.
export default function PlanSummary({
  currency,
  incomeCents,
  incomeProvisional,
  budgetedCents,
  billsCents,
  unallocatedCents,
  tasks,
}: PlanSummaryData) {
  const unallocated = unallocatedCents;
  const over = unallocated < 0;
  // When variable income may still arrive, being above the recorded income is
  // normal, so it is shown plainly instead of as an error (spec 010).
  const overIsError = over && !incomeProvisional;

  return (
    <section
      aria-label="Plan summary"
      className="space-y-4 rounded-xl border border-border bg-background shadow-sm p-5"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Income (take-home)"
          value={formatMoney(incomeCents, currency)}
          note={incomeProvisional ? "Variable income counts once you record it." : undefined}
        />
        <Stat
          label="Budgeted"
          value={formatMoney(budgetedCents, currency)}
          note={`of which bills ${formatMoney(billsCents, currency)}`}
        />
        <Stat
          label={
            over
              ? incomeProvisional
                ? "Over recorded income by"
                : "Over-allocated by"
              : "Unallocated Income"
          }
          value={formatMoney(Math.abs(unallocated), currency)}
          danger={overIsError}
        />
      </div>
      {tasks.length > 0 && (
        <ul aria-label="Tasks" className="flex flex-wrap gap-2 border-t border-border pt-4">
          {tasks.map((t) => (
            <li key={`${t.code}-${t.categoryId ?? t.goalId ?? ""}`}>
              <Link
                href={t.href}
                title={t.message}
                className={`${secondaryButtonCls} inline-block ${
                  t.severity === "warning" ? "border-danger text-danger" : ""
                }`}
              >
                {t.severity === "warning" && <span className="sr-only">Warning: </span>}
                {t.actionLabel}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
