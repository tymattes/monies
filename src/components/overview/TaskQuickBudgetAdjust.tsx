"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { parseMoney, toInputString } from "@/lib/money";
import { buttonCls, inputCls } from "../ui";

// The single-row equivalent of BudgetEditor's per-category editor, for the
// "category_over_budget" task (spec 035): the category's own name is
// already in the task's message above this, so the field just needs a
// label and a Save button. Only rendered when the month is editable.
export default function TaskQuickBudgetAdjust({
  month,
  currency,
  categoryId,
  currentAmountCents,
}: {
  month: string;
  currency: string;
  categoryId: string;
  currentAmountCents: number;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => toInputString(currentAmountCents, currency));
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const minor = parseMoney(draft, currency);
    if (minor === null) return setStatus("Enter an amount like 250.00");
    setBusy(true);
    setStatus("");
    const { ok, error } = await api(
      `/api/budgets/${month}/allocations/${categoryId}`,
      "PUT",
      { amountCents: minor },
    );
    setBusy(false);
    if (!ok) return setStatus(error ?? "Could not save");
    setStatus("Saved");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="flex w-full flex-wrap items-end gap-2 border-t border-border pt-3">
      <div className="space-y-1">
        <label htmlFor={`task-budget-${categoryId}`} className="block text-xs text-muted">
          New budgeted amount
        </label>
        <input
          id={`task-budget-${categoryId}`}
          inputMode="decimal"
          required
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setStatus("");
          }}
          className={`${inputCls} w-28! text-right text-sm tabular-nums`}
        />
      </div>
      <button type="submit" disabled={busy} className={`${buttonCls} text-sm`}>
        Save
      </button>
      <span aria-live="polite" className="w-full text-xs text-muted">
        {status}
      </span>
    </form>
  );
}
