"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { formatMoney, parseMoney, toInputString } from "@/lib/money";
import { inputCls } from "./ui";

type Line = { id: string; name: string; amountCents: number };

export default function BudgetEditor({
  month,
  monthName,
  currency,
  editable,
  lines,
}: {
  month: string;
  monthName: string;
  currency: string;
  editable: boolean;
  lines: Line[];
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

  if (lines.length === 0) {
    return (
      <p className="rounded-lg border border-foreground/10 p-6 text-sm text-muted">
        No categories in {monthName}. Add some below, or go to a later month.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        {editable
          ? `Changes apply from ${monthName} onward. Earlier months are not affected.`
          : "Past months are read-only so history stays accurate."}
      </p>
      <ul className="divide-y divide-foreground/10 rounded-lg border border-foreground/10">
        {lines.map((l) => (
          <li
            key={l.id}
            className="flex items-center justify-between gap-4 px-4 py-3"
          >
            <label htmlFor={`amount-${l.id}`} className="min-w-0 truncate font-medium">
              {l.name}
            </label>
            {editable ? (
              <div className="flex shrink-0 items-center gap-3">
                <span
                  aria-live="polite"
                  className={`text-xs ${
                    status[l.id] && status[l.id] !== "Saved" && status[l.id] !== "Saving…"
                      ? "text-danger"
                      : "text-muted"
                  }`}
                >
                  {status[l.id]}
                </span>
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
                  className={`${inputCls} w-32 text-right tabular-nums`}
                />
              </div>
            ) : (
              <span className="tabular-nums">
                {formatMoney(saved[l.id] ?? 0, currency)}
              </span>
            )}
          </li>
        ))}
        <li className="flex items-center justify-between gap-4 bg-foreground/5 px-4 py-3 font-semibold">
          <span>Total budgeted</span>
          <span className="tabular-nums">{formatMoney(total, currency)}</span>
        </li>
      </ul>
    </div>
  );
}
