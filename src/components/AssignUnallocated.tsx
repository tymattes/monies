"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { GoalType } from "@/lib/goalTypes";
import { api, focusAssignPanel } from "@/lib/client";
import { addMonths, monthLabel } from "@/lib/months";
import { formatMoney, parseMoney, toInputString } from "@/lib/money";
import { buttonCls, cardCls, inputCls, secondaryButtonCls } from "./ui";

type Goal = { id: string; name: string; type: GoalType; amountCents: number };

// A row targets one goal (spec 020 — Assign is goals-only; a category's
// budget is set by hand on Budget or reflects what it actually costs).
type Row = { key: number; target: string; amount: string };

// The last successful assign, kept only long enough to show the confirmation
// (spec 026); cleared by any edit.
type Done = { items: { name: string; amountCents: number }[] };

// Splits `total` minor units across `n` rows; leftover cents go to the first rows.
function evenSplit(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  const extra = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

// "a", "a and b", "a, b, and c".
function formatList(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  if (parts.length === 2) return parts.join(" and ");
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

// Puts part or all of the month's leftover into one or more goals in one
// click, from this month onward. Nothing is assigned automatically: the user
// picks the goals and amounts (the first row starts on the first Saving goal,
// if there is one, with the whole amount — debt payoff is never preselected,
// since topping it up is a deliberate choice, spec 012/014). Lives near the
// top of the Goals page (spec 032) — leftover income and the goal it funds,
// and the check-off right below once the money moves.
export default function AssignUnallocated({
  month,
  monthName,
  currency,
  goals,
  unallocated,
  bare = false,
}: {
  month: string;
  monthName: string;
  currency: string;
  goals: Goal[];
  unallocated: number;
  // Skips the outer card chrome when embedded inside another card that
  // already provides it (Overview's Tasks, spec 035) — the Goals page's own
  // usage keeps the default full card.
  bare?: boolean;
}) {
  const router = useRouter();
  const savings = goals.find((g) => g.type === "saving");
  const [rows, setRows] = useState<Row[]>(() => [
    {
      key: 0,
      target: savings ? savings.id : "",
      amount: toInputString(unallocated, currency),
    },
  ]);
  const [nextKey, setNextKey] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Done | null>(null);

  // Arriving from the Plan summary on another page (…/goals#assign).
  const arrivedViaHash = useRef(false);
  useEffect(() => {
    if (arrivedViaHash.current) return;
    arrivedViaHash.current = true;
    if (window.location.hash === "#assign") focusAssignPanel();
  }, []);

  const parsed = rows.map((r) => ({ ...r, minor: parseMoney(r.amount, currency) }));
  const total = parsed.reduce((sum, r) => sum + (r.minor ?? 0), 0);
  const left = unallocated - total;
  // Assign is a one-month top-up (spec 017): each target reverts to its
  // earlier amount the following month unless already changed there.
  const nextMonthName = monthLabel(addMonths(month, 1));
  const chosen = rows.map((r) => r.target).filter(Boolean);
  const valid =
    parsed.every((r) => r.target !== "" && r.minor !== null && r.minor > 0) &&
    new Set(chosen).size === rows.length &&
    total > 0 &&
    total <= unallocated;
  const targetCount = goals.length;

  function update(key: number, patch: Partial<Row>) {
    setDone(null);
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setDone(null);
    setRows((rs) => [
      ...rs,
      { key: nextKey, target: "", amount: left > 0 ? toInputString(left, currency) : "" },
    ]);
    setNextKey((k) => k + 1);
  }

  function splitEvenly() {
    setDone(null);
    const parts = evenSplit(unallocated, rows.length);
    setRows((rs) =>
      rs.map((r, i) => ({ ...r, amount: toInputString(parts[i], currency) })),
    );
  }

  // Sets this row's amount to absorb whatever is left after every other row
  // (spec 016). Only rendered while `left > 0`, which on its own guarantees
  // this is always positive and the resulting total never exceeds
  // `unallocated`: `left > 0` means the sum of all rows (this one included)
  // is below `unallocated`, so the other rows alone sum to less still.
  function fillRemaining(key: number) {
    const own = parsed.find((r) => r.key === key)?.minor ?? 0;
    const othersTotal = total - own;
    update(key, { amount: toInputString(unallocated - othersTotal, currency) });
  }

  async function assign() {
    setBusy(true);
    setError("");
    const { ok, error } = await api(
      `/api/budgets/${month}/assign-unallocated`,
      "POST",
      {
        assignments: parsed.map((r) => ({
          goalId: r.target,
          amountCents: r.minor,
        })),
      },
    );
    setBusy(false);
    if (!ok) return setError(error ?? "Could not assign");
    setDone({
      items: parsed.map((r) => ({
        name: goals.find((g) => g.id === r.target)?.name ?? "",
        amountCents: r.minor ?? 0,
      })),
    });
    setRows([{ key: 0, target: savings ? savings.id : "", amount: "" }]);
    setNextKey(1);
    router.refresh();
  }

  return (
    <section
      id="assign"
      className={bare ? "w-full space-y-3 border-t border-border pt-3" : `${cardCls} space-y-3 p-5`}
    >
      <p className="text-muted">
        Assign the unallocated {formatMoney(unallocated, currency)} to one or
        more goals:
      </p>
      <p className={`text-sm font-medium tabular-nums ${left < 0 ? "text-danger" : ""}`}>
        Assigning {formatMoney(total, currency)} of {formatMoney(unallocated, currency)} —{" "}
        {formatMoney(left, currency)} left
      </p>

      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li
            key={r.key}
            className="grid grid-cols-[1fr_auto] items-center gap-2 sm:grid-cols-[1fr_auto_auto_auto]"
          >
            <select
              aria-label={`Goal ${i + 1}`}
              value={r.target}
              onChange={(e) => update(r.key, { target: e.target.value })}
              className={`${inputCls} w-auto! min-w-40`}
            >
              <option value="">Choose a goal</option>
              {goals
                .filter((g) => g.id === r.target || !chosen.includes(g.id))
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} · {formatMoney(g.amountCents, currency)}
                  </option>
                ))}
            </select>
            <input
              aria-label={`Amount for goal ${i + 1}`}
              inputMode="decimal"
              value={r.amount}
              onChange={(e) => update(r.key, { amount: e.target.value })}
              className={`${inputCls} w-32! text-right tabular-nums`}
            />
            {left > 0 && (
              <button
                type="button"
                aria-label={`Fill remaining for goal ${i + 1}`}
                onClick={() => fillRemaining(r.key)}
                className={secondaryButtonCls}
              >
                Fill remaining
              </button>
            )}
            {rows.length > 1 && (
              <button
                type="button"
                aria-label={`Remove goal ${i + 1}`}
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
          Add goal
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
        {left < 0 ? (
          `That is ${formatMoney(-left, currency)} more than the unallocated amount.`
        ) : done ? (
          <>
            Added{" "}
            {formatList(
              done.items.map((i) => `${formatMoney(i.amountCents, currency)} to ${i.name}`),
            )}{" "}
            for {monthName}. Check it off below when the money moves.
          </>
        ) : left === 0 ? (
          `Assigning all of it to ${monthName}; ${nextMonthName} goes back to the earlier amount unless you change it. It counts against Unallocated Income once you check the goal off on Goals.`
        ) : (
          `Assigning ${formatMoney(total, currency)} to ${monthName}; ${formatMoney(left, currency)} stays unallocated. ${nextMonthName} goes back to the earlier amount unless you change it. It counts against Unallocated Income once you check the goal off on Goals.`
        )}
      </p>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
