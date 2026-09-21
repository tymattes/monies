"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { formatMoney, parseMoney, toInputString } from "@/lib/money";
import { buttonCls, inputCls, secondaryButtonCls } from "./ui";

type Line = {
  id: string;
  name: string;
  amountCents: number;
  // Monthly cost of the bills in this category (spec 007).
  billsCents: number;
};

type Row = { key: number; categoryId: string; amount: string };

// Splits `total` minor units across `n` rows; leftover cents go to the first rows.
function evenSplit(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  const extra = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

// Puts part or all of the month's leftover into one or more categories in one
// click, from this month onward. Nothing is assigned automatically: the user
// picks the categories and amounts (the first row starts on Savings, if there
// is one, with the whole amount).
function AssignUnallocated({
  month,
  monthName,
  currency,
  lines,
  unallocated,
}: {
  month: string;
  monthName: string;
  currency: string;
  lines: Line[];
  unallocated: number;
}) {
  const router = useRouter();
  const savings = lines.find((l) => l.name.trim().toLowerCase() === "savings");
  const [rows, setRows] = useState<Row[]>(() => [
    {
      key: 0,
      categoryId: savings?.id ?? "",
      amount: toInputString(unallocated, currency),
    },
  ]);
  const [nextKey, setNextKey] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const parsed = rows.map((r) => ({ ...r, minor: parseMoney(r.amount, currency) }));
  const total = parsed.reduce((sum, r) => sum + (r.minor ?? 0), 0);
  const left = unallocated - total;
  const chosen = rows.map((r) => r.categoryId).filter(Boolean);
  const valid =
    parsed.every((r) => r.categoryId !== "" && r.minor !== null && r.minor > 0) &&
    new Set(chosen).size === rows.length &&
    total > 0 &&
    total <= unallocated;

  function update(key: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((rs) => [
      ...rs,
      { key: nextKey, categoryId: "", amount: left > 0 ? toInputString(left, currency) : "" },
    ]);
    setNextKey((k) => k + 1);
  }

  function splitEvenly() {
    const parts = evenSplit(unallocated, rows.length);
    setRows((rs) =>
      rs.map((r, i) => ({ ...r, amount: toInputString(parts[i], currency) })),
    );
  }

  async function assign() {
    setBusy(true);
    setError("");
    const { ok, error } = await api(
      `/api/budgets/${month}/assign-unallocated`,
      "POST",
      {
        assignments: parsed.map((r) => ({
          categoryId: r.categoryId,
          amountCents: r.minor,
        })),
      },
    );
    setBusy(false);
    if (!ok) return setError(error ?? "Could not assign");
    router.refresh();
  }

  return (
    <li className="space-y-3 px-4 py-3 text-sm">
      <p className="text-muted">
        Assign the unallocated {formatMoney(unallocated, currency)} to one or
        more categories:
      </p>

      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={r.key} className="flex flex-wrap items-center gap-2">
            <select
              aria-label={`Category ${i + 1}`}
              value={r.categoryId}
              onChange={(e) => update(r.key, { categoryId: e.target.value })}
              className={`${inputCls} w-auto min-w-40`}
            >
              <option value="">Choose a category</option>
              {lines
                .filter((l) => l.id === r.categoryId || !chosen.includes(l.id))
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
            </select>
            <input
              aria-label={`Amount for category ${i + 1}`}
              inputMode="decimal"
              value={r.amount}
              onChange={(e) => update(r.key, { amount: e.target.value })}
              className={`${inputCls} w-32 text-right tabular-nums`}
            />
            {rows.length > 1 && (
              <button
                type="button"
                aria-label={`Remove category ${i + 1}`}
                onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                className={secondaryButtonCls}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addRow}
          disabled={rows.length >= lines.length}
          className={secondaryButtonCls}
        >
          Add category
        </button>
        {rows.length > 1 && (
          <button type="button" onClick={splitEvenly} className={secondaryButtonCls}>
            Split evenly
          </button>
        )}
        <button
          type="button"
          onClick={assign}
          disabled={busy || !valid}
          className={buttonCls}
        >
          Assign
        </button>
      </div>

      <p
        aria-live="polite"
        className={`text-xs ${left < 0 ? "text-danger" : "text-muted"}`}
      >
        {left < 0
          ? `That is ${formatMoney(-left, currency)} more than the unallocated amount.`
          : left === 0
            ? `Assigning all of it from ${monthName} onward. You can change any amount afterwards.`
            : `Assigning ${formatMoney(total, currency)}; ${formatMoney(left, currency)} stays unallocated. Applies from ${monthName} onward.`}
      </p>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </li>
  );
}

export default function BudgetEditor({
  month,
  monthName,
  currency,
  editable,
  lines,
  incomeCents,
  billsTotalCents,
}: {
  month: string;
  monthName: string;
  currency: string;
  editable: boolean;
  lines: Line[];
  incomeCents: number;
  billsTotalCents: number;
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
  const unallocated = incomeCents - total;

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
      <p className="rounded-lg border border-border p-6 text-sm text-muted">
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
      <ul className="divide-y divide-border rounded-lg border border-border">
        <li
          aria-hidden="true"
          className="hidden items-center justify-between gap-4 px-4 py-2 text-xs text-muted sm:flex"
        >
          <span>Category</span>
          <div className="flex items-center gap-4">
            <span className="w-24 text-right">Bills</span>
            <span className="w-24 text-right">Left</span>
            <span className="w-32 text-right">Budgeted</span>
          </div>
        </li>
        {lines.map((l) => {
          const budgeted = saved[l.id] ?? 0;
          const left = budgeted - l.billsCents;
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
                      className={`${inputCls} w-32 text-right tabular-nums`}
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
                  Bills {formatMoney(l.billsCents, currency)} · Left{" "}
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
          <span>Total budgeted</span>
          <span className="tabular-nums">{formatMoney(total, currency)}</span>
        </li>
        <li className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
          <span className="text-muted">Monthly bills</span>
          <span className="tabular-nums">{formatMoney(billsTotalCents, currency)}</span>
        </li>
        <li className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
          <span className="text-muted">Household income (take-home)</span>
          <span className="tabular-nums">{formatMoney(incomeCents, currency)}</span>
        </li>
        <li className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
          <span className={incomeCents - billsTotalCents < 0 ? "text-danger" : "text-muted"}>
            {incomeCents - billsTotalCents < 0
              ? "Bills exceed income by"
              : "Left after bills"}
          </span>
          <span
            className={`tabular-nums ${incomeCents - billsTotalCents < 0 ? "text-danger" : ""}`}
          >
            {formatMoney(Math.abs(incomeCents - billsTotalCents), currency)}
          </span>
        </li>
        <li className="flex items-center justify-between gap-4 px-4 py-3 text-sm font-medium">
          <span className={unallocated < 0 ? "text-danger" : undefined}>
            {unallocated < 0 ? "Over-allocated by" : "Unallocated"}
          </span>
          <span
            className={`tabular-nums ${unallocated < 0 ? "text-danger" : ""}`}
          >
            {formatMoney(Math.abs(unallocated), currency)}
          </span>
        </li>
        {editable && unallocated > 0 && (
          <AssignUnallocated
            key={unallocated}
            month={month}
            monthName={monthName}
            currency={currency}
            lines={lines}
            unallocated={unallocated}
          />
        )}
      </ul>
    </div>
  );
}
