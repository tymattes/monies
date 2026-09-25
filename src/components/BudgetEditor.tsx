"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { formatMoney, parseMoney, toInputString } from "@/lib/money";
import type { Task } from "@/lib/tasks";
import PlanSummary from "./PlanSummary";
import { inputCls } from "./ui";

type Line = {
  id: string;
  name: string;
  amountCents: number;
  // Monthly cost of the bills in this category (spec 007), and the
  // expenses logged against it this month (spec 038).
  billsCents: number;
  expensesCents: number;
};

export default function BudgetEditor({
  month,
  monthName,
  currency,
  editable,
  lines,
  goalsCommittedCents,
  incomeCents,
  incomeProvisional,
  billsTotalCents,
  unallocatedCents,
  tasks,
}: {
  month: string;
  monthName: string;
  currency: string;
  editable: boolean;
  lines: Line[];
  // Saving/Debt payoff goals (spec 014): not edited here (see /goals), but
  // folded into the Budgeted total below, since that money is just as
  // earmarked as a category's budget. Assign itself lives on the Goals
  // page (spec 032).
  goalsCommittedCents: number;
  incomeCents: number;
  incomeProvisional: boolean;
  billsTotalCents: number;
  // Server-given, static: editing a category's amount changes the Budgeted
  // total but never this (spec 022 — budgeted amounts don't claim income).
  unallocatedCents: number;
  // Also server-given and static, like unallocatedCents above (spec 033) —
  // editing a category amount doesn't recompute tasks live.
  tasks: Task[];
}) {
  // Last saved amount per category, and what is currently typed.
  const [saved, setSaved] = useState<Record<string, number>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, l.amountCents])),
  );
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      lines.map((l) => [l.id, toInputString(l.amountCents, currency)]),
    ),
  );
  const [status, setStatus] = useState<Record<string, string>>({});

  const total = Object.values(saved).reduce((a, b) => a + b, 0);

  function note(id: string, message: string) {
    setStatus((s) => ({ ...s, [id]: message }));
  }

  async function commit(id: string) {
    const minor = parseMoney(drafts[id] ?? "", currency);
    if (minor === null) return note(id, "Enter an amount like 250.00");
    if (minor === saved[id]) {
      setDrafts((d) => ({ ...d, [id]: toInputString(minor, currency) }));
      return note(id, "");
    }
    note(id, "Saving…");
    const { ok, error } = await api(
      `/api/budgets/${month}/allocations/${id}`,
      "PUT",
      { amountCents: minor },
    );
    if (!ok) return note(id, error ?? "Could not save");
    setSaved((s) => ({ ...s, [id]: minor }));
    setDrafts((d) => ({ ...d, [id]: toInputString(minor, currency) }));
    note(id, "Saved");
  }

  const summary = (
    <PlanSummary
      month={month}
      currency={currency}
      editable={editable}
      incomeCents={incomeCents}
      incomeProvisional={incomeProvisional}
      budgetedCents={total + goalsCommittedCents}
      billsCents={billsTotalCents}
      unallocatedCents={unallocatedCents}
      tasks={tasks}
    />
  );

  if (lines.length === 0) {
    return (
      <div className="space-y-3">
        {summary}
        <p className="rounded-xl border border-border bg-background shadow-sm p-6 text-sm text-muted">
          No categories in {monthName}. Add some below, or go to a later month.
        </p>
      </div>
    );
  }

  const billsColumn = lines.reduce((sum, l) => sum + l.billsCents, 0);
  const expensesColumn = lines.reduce((sum, l) => sum + l.expensesCents, 0);
  const leftColumn = total - billsColumn - expensesColumn;

  return (
    <div className="space-y-3">
      {summary}
      <p className="text-sm text-muted">
        {editable
          ? `Changes apply from ${monthName} onward. Earlier months are not affected.`
          : "Past months are read-only so history stays accurate."}
      </p>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background shadow-sm">
        <li
          aria-hidden="true"
          className="hidden items-center justify-between gap-4 bg-surface-subtle px-4 py-2 text-xs text-muted sm:flex"
        >
          <span>Category</span>
          <div className="flex items-center gap-4">
            <span className="w-24 text-right">Bills</span>
            <span className="w-24 text-right">Expenses</span>
            <span className="w-24 text-right">Left</span>
            <span className="w-32 text-right">Budgeted</span>
          </div>
        </li>
        {lines.map((l) => {
          const budgeted = saved[l.id] ?? 0;
          const left = budgeted - l.billsCents - l.expensesCents;
          return (
            <li key={l.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <label
                  htmlFor={`amount-${l.id}`}
                  className="min-w-0 truncate font-medium"
                >
                  {l.name}
                </label>
                <div className="flex shrink-0 items-center gap-4">
                  <span className="hidden w-24 text-right text-sm tabular-nums text-muted sm:block">
                    {formatMoney(l.billsCents, currency)}
                  </span>
                  <span className="hidden w-24 text-right text-sm tabular-nums text-muted sm:block">
                    {formatMoney(l.expensesCents, currency)}
                  </span>
                  <span
                    className={`hidden w-24 text-right text-sm tabular-nums sm:block ${
                      left < 0 ? "text-danger" : "text-muted"
                    }`}
                  >
                    {formatMoney(left, currency)}
                  </span>
                  {editable ? (
                    <input
                      id={`amount-${l.id}`}
                      inputMode="decimal"
                      value={drafts[l.id] ?? ""}
                      onChange={(e) => {
                        setDrafts((d) => ({ ...d, [l.id]: e.target.value }));
                        note(l.id, "");
                      }}
                      onBlur={() => commit(l.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                      className={`${inputCls} w-32! text-right tabular-nums`}
                    />
                  ) : (
                    <span className="w-32 text-right tabular-nums">
                      {formatMoney(budgeted, currency)}
                    </span>
                  )}
                </div>
              </div>
              <div
                className={`mt-1 flex items-center justify-between gap-3 text-xs ${
                  status[l.id] ? "" : "sm:hidden"
                }`}
              >
                <span className={`sm:hidden ${left < 0 ? "text-danger" : "text-muted"}`}>
                  Bills {formatMoney(l.billsCents, currency)} · Expenses{" "}
                  {formatMoney(l.expensesCents, currency)} · Left{" "}
                  {formatMoney(left, currency)}
                </span>
                <span
                  aria-live="polite"
                  className={`ml-auto ${
                    status[l.id] && status[l.id] !== "Saved" && status[l.id] !== "Saving…"
                      ? "text-danger"
                      : "text-muted"
                  }`}
                >
                  {status[l.id]}
                </span>
              </div>
            </li>
          );
        })}
        <li className="flex items-center justify-between gap-4 bg-surface px-4 py-3 font-semibold">
          <span>Total</span>
          <div className="flex items-center gap-4 tabular-nums">
            <span className="hidden w-24 text-right sm:block">
              {formatMoney(billsColumn, currency)}
            </span>
            <span className="hidden w-24 text-right sm:block">
              {formatMoney(expensesColumn, currency)}
            </span>
            <span className="hidden w-24 text-right sm:block">
              {formatMoney(leftColumn, currency)}
            </span>
            <span className="w-32 text-right">{formatMoney(total, currency)}</span>
          </div>
        </li>
      </ul>
    </div>
  );
}
