"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { GoalType } from "@/lib/goalTypes";
import { api, focusAssignPanel } from "@/lib/client";
import { formatMoney, parseMoney, toInputString } from "@/lib/money";
import { buttonCls, cardCls, inputCls, secondaryButtonCls } from "./ui";

type Line = {
  id: string;
  name: string;
  amountCents: number;
  // Monthly cost of the bills in this category (spec 007).
  billsCents: number;
};

type Goal = { id: string; name: string; type: GoalType };

// A row's target is a category or a goal (spec 014), encoded as
// "cat:<id>" / "goal:<id>" so a single <select> can offer both.
type Row = { key: number; target: string; amount: string };

// Splits `total` minor units across `n` rows; leftover cents go to the first rows.
function evenSplit(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  const extra = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

// Puts part or all of the month's leftover into one or more categories or
// goals in one click, from this month onward. Nothing is assigned
// automatically: the user picks the targets and amounts (the first row
// starts on the first Saving goal, if there is one, with the whole amount —
// debt payoff is never preselected, since topping it up is a deliberate
// choice, spec 012/014). Lives on the Income page (spec 015) — money coming
// in and where it's going fit naturally on the same page.
export default function AssignUnallocated({
  month,
  monthName,
  currency,
  lines,
  goals,
  unallocated,
}: {
  month: string;
  monthName: string;
  currency: string;
  lines: Line[];
  goals: Goal[];
  unallocated: number;
}) {
  const router = useRouter();
  const savings = goals.find((g) => g.type === "saving");
  const [rows, setRows] = useState<Row[]>(() => [
    {
      key: 0,
      target: savings ? `goal:${savings.id}` : "",
      amount: toInputString(unallocated, currency),
    },
  ]);
  const [nextKey, setNextKey] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Arriving from the Plan summary on another page (…/income#assign).
  const arrivedViaHash = useRef(false);
  useEffect(() => {
    if (arrivedViaHash.current) return;
    arrivedViaHash.current = true;
    if (window.location.hash === "#assign") focusAssignPanel();
  }, []);

  const parsed = rows.map((r) => ({ ...r, minor: parseMoney(r.amount, currency) }));
  const total = parsed.reduce((sum, r) => sum + (r.minor ?? 0), 0);
  const left = unallocated - total;
  const chosen = rows.map((r) => r.target).filter(Boolean);
  const valid =
    parsed.every((r) => r.target !== "" && r.minor !== null && r.minor > 0) &&
    new Set(chosen).size === rows.length &&
    total > 0 &&
    total <= unallocated;
  const targetCount = lines.length + goals.length;

  function update(key: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((rs) => [
      ...rs,
      { key: nextKey, target: "", amount: left > 0 ? toInputString(left, currency) : "" },
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
        assignments: parsed.map((r) => {
          const [kind, id] = r.target.split(":");
          return kind === "goal"
            ? { goalId: id, amountCents: r.minor }
            : { categoryId: id, amountCents: r.minor };
        }),
      },
    );
    setBusy(false);
    if (!ok) return setError(error ?? "Could not assign");
    router.refresh();
  }

  return (
    <section id="assign" className={`${cardCls} space-y-3 p-5`}>
      <p className="text-muted">
        Assign the unallocated {formatMoney(unallocated, currency)} to one or
        more categories or goals:
      </p>

      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={r.key} className="flex flex-wrap items-center gap-2">
            <select
              aria-label={`Category ${i + 1}`}
              value={r.target}
              onChange={(e) => update(r.key, { target: e.target.value })}
              className={`${inputCls} w-auto! min-w-40`}
            >
              <option value="">Choose a category</option>
              {lines.length > 0 && (
                <optgroup label="Expenses">
                  {lines
                    .filter((l) => `cat:${l.id}` === r.target || !chosen.includes(`cat:${l.id}`))
                    .map((l) => (
                      <option key={l.id} value={`cat:${l.id}`}>
                        {l.name}
                      </option>
                    ))}
                </optgroup>
              )}
              {goals.length > 0 && (
                <optgroup label="Saving & debt payoff">
                  {goals
                    .filter((g) => `goal:${g.id}` === r.target || !chosen.includes(`goal:${g.id}`))
                    .map((g) => (
                      <option key={g.id} value={`goal:${g.id}`}>
                        {g.name}
                      </option>
                    ))}
                </optgroup>
              )}
            </select>
            <input
              aria-label={`Amount for category ${i + 1}`}
              inputMode="decimal"
              value={r.amount}
              onChange={(e) => update(r.key, { amount: e.target.value })}
              className={`${inputCls} w-32! text-right tabular-nums`}
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
          disabled={rows.length >= targetCount}
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
    </section>
  );
}
