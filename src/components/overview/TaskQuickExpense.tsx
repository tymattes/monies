"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { currentDate } from "@/lib/months";
import { parseMoney } from "@/lib/money";
import { buttonCls, inputCls } from "../ui";

type Category = { id: string; name: string };

// The compact form for the "Log this month's expenses" task (spec 035): the
// same POST /api/expenses call ExpenseLog's form makes, without the list
// below it. The task is permanent (spec 032), so a successful submit clears
// the fields rather than making the card disappear. `log_expenses` only ever
// appears for the current month (buildTasks), so the date needs no
// month-clamping the way ExpenseLog's does.
export default function TaskQuickExpense({
  currency,
  categories,
}: {
  currency: string;
  categories: Category[];
}) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => currentDate());
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const minor = parseMoney(amount, currency);
    if (minor === null || minor === 0) {
      return setStatus("Enter an amount like 12.50");
    }
    if (!categoryId) return setStatus("Choose a category");
    setBusy(true);
    setStatus("");
    const { ok, error } = await api("/api/expenses", "POST", {
      categoryId,
      amountCents: minor,
      spentOn: date,
      description: description.trim() || null,
    });
    setBusy(false);
    if (!ok) return setStatus(error ?? "Could not save");
    setAmount("");
    setCategoryId("");
    setDescription("");
    setStatus("Logged");
    router.refresh();
  }

  return (
    <form onSubmit={add} className="flex w-full flex-wrap items-end gap-2 border-t border-border pt-3">
      <div className="min-w-32 flex-1 space-y-1">
        <label htmlFor="task-expense-category" className="block text-xs text-muted">
          Category
        </label>
        <select
          id="task-expense-category"
          required
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className={`${inputCls} text-sm`}
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
        <label htmlFor="task-expense-amount" className="block text-xs text-muted">
          Amount
        </label>
        <input
          id="task-expense-amount"
          inputMode="decimal"
          required
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={`${inputCls} w-24! text-right text-sm tabular-nums`}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="task-expense-date" className="block text-xs text-muted">
          Date
        </label>
        <input
          id="task-expense-date"
          type="date"
          required
          value={date}
          max={currentDate()}
          onChange={(e) => setDate(e.target.value)}
          className={`${inputCls} w-auto! text-sm`}
        />
      </div>
      <div className="min-w-32 flex-1 space-y-1">
        <label htmlFor="task-expense-description" className="block text-xs text-muted">
          Description (optional)
        </label>
        <input
          id="task-expense-description"
          type="text"
          maxLength={200}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={`${inputCls} text-sm`}
        />
      </div>
      <button type="submit" disabled={busy} className={`${buttonCls} text-sm`}>
        Add
      </button>
      <span aria-live="polite" className="w-full text-xs text-muted">
        {status}
      </span>
    </form>
  );
}
