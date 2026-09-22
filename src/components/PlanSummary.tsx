"use client";

import Link from "next/link";
import { focusAssignPanel } from "@/lib/client";
import { formatMoney } from "@/lib/money";
import type { PlanSummaryData } from "@/lib/plan";
import { buttonCls } from "./ui";

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

// Income, Budgeted and Unallocated for the month, shown on every Plan page.
// `assign` is how the Assign button behaves: on the Budget page it scrolls to
// the panel ("scroll"); elsewhere it links to it ("link").
export default function PlanSummary({
  month,
  currency,
  editable,
  incomeCents,
  incomeProvisional,
  budgetedCents,
  billsCents,
  assign,
}: PlanSummaryData & { assign: "scroll" | "link" }) {
  const unallocated = incomeCents - budgetedCents;
  const over = unallocated < 0;
  // When variable income may still arrive, being above the recorded income is
  // normal, so it is shown plainly instead of as an error (spec 010).
  const overIsError = over && !incomeProvisional;

  return (
    <section
      aria-label="Plan summary"
      className="grid gap-4 rounded-xl border border-border bg-background shadow-sm p-5 sm:grid-cols-3"
    >
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
      <div className="flex items-end justify-between gap-3 sm:flex-col sm:items-start sm:justify-start">
        <Stat
          label={
            over
              ? incomeProvisional
                ? "Over recorded income by"
                : "Over-allocated by"
              : "Unallocated"
          }
          value={formatMoney(Math.abs(unallocated), currency)}
          danger={overIsError}
        />
        {editable && unallocated > 0 &&
          (assign === "scroll" ? (
            <button type="button" onClick={focusAssignPanel} className={buttonCls}>
              Assign
            </button>
          ) : (
            <Link
              href={`/budget?month=${month}#assign`}
              className={`${buttonCls} inline-block`}
            >
              Assign
            </Link>
          ))}
      </div>
    </section>
  );
}
