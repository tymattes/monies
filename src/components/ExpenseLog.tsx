"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import type { ExpenseLine } from "@/lib/expenses";
import { formatMoney, parseMoney } from "@/lib/money";
import { buttonCls, cardCls, inputCls, secondaryButtonCls } from "./ui";

type Category = { id: string; name: string };

// The quick-entry form and the month's logged expenses. An expense is a
// fact (spec 019): past dates are fine, future dates are refused by the
// API, and delete is the only way to undo — there is no edit.
export default function ExpenseLog({
  month,
  currency,
  categories,
  expenses,
}: {
  month: string;
  currency: string;
  categories: Category[];
  expenses: ExpenseLine[];
}) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => {
    // Default the date to today, clamped into the viewed month when today is
    // not in it, so the entry lands where the user is looking.
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayStr = `${y}-${m}-${d}`;
    return todayStr.startsWith(month) ? todayStr : `${month}-01`;
  });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const minor = parseMoney(amount, currency);
    if (minor === null || minor === 0) {
      return setStatus("Enter an amount like 12.50");
    }
    setBusy(true);
    setStatus("");
    const { ok, error } = await api("/api/expenses", "POST", {
      categoryId,
      amountCents: minor,
      spentOn: date,
    });
    setBusy(false);
    if (!ok) return setStatus(error ?? "Could not save");
    setAmount("");
    setCategoryId("");
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this expense?")) return;
    const { ok, error } = await api(`/api/expenses/${id}`, "DELETE");
    if (!ok) return setStatus(error ?? "Could not delete");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className={`${cardCls} p-5`}>
        <h2 className="text-lg font-semibold tracking-tight">Log an expense</h2>
        <form onSubmit={add} className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1 space-y-1">
            <label htmlFor="expense-category" className="block text-xs text-muted">
              Category
            </label>
            <select
              id="expense-category"
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputCls}
            >
              <option value="">Choose a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="expense-amount" className="block text-xs text-muted">
              Amount
            </label>
            <input
              id="expense-amount"
              inputMode="decimal"
              required
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`${inputCls} w-28! text-right tabular-nums`}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="expense-date" className="block text-xs text-muted">
              Date
            </label>
            <input
              id="expense-date"
              type="date"
              required
              value={date}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
              className={`${inputCls} w-auto!`}
            />
          </div>
          <button type="submit" disabled={busy} className={buttonCls}>
            Add expense
          </button>
          <span aria-live="polite" className="text-xs text-muted">
            {status}
          </span>
        </form>
      </section>

      <section className={`${cardCls} overflow-hidden`}>
        {expenses.length === 0 ? (
          <p className="p-5 text-sm text-muted">
            No expenses logged this month yet.
          </p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {expenses.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0 truncate">
                  <span className="tabular-nums">{x.spentOn}</span>
                  <span className="text-muted"> · {x.categoryName}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="tabular-nums">{formatMoney(x.amountCents, currency)}</span>
                  <button
                    type="button"
                    onClick={() => remove(x.id)}
                    className={secondaryButtonCls}
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
