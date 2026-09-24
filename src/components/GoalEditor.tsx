"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { groupByType, type GoalType } from "@/lib/goalTypes";
import { api } from "@/lib/client";
import { formatMoney, parseMoney, toInputString } from "@/lib/money";
import { inputCls } from "./ui";

type Line = {
  id: string;
  name: string;
  type: GoalType;
  amountCents: number;
  // Whether the goal is checked off for this month (spec 014).
  checked: boolean;
};

// Editable amount per goal (time-versioned, read-only in the past like a
// budget allocation) and a checkbox for "did this happen" — editable for
// any month, since it records a fact, not a plan.
export default function GoalEditor({
  month,
  currency,
  editable,
  lines,
}: {
  month: string;
  currency: string;
  editable: boolean;
  lines: Line[];
}) {
  const [saved, setSaved] = useState<Record<string, number>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, l.amountCents])),
  );
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, toInputString(l.amountCents, currency)])),
  );
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, l.checked])),
  );
  const [status, setStatus] = useState<Record<string, string>>({});
  const router = useRouter();

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
    const { ok, error } = await api(`/api/goals/month/${month}/amounts/${id}`, "PUT", {
      amountCents: minor,
    });
    if (!ok) return note(id, error ?? "Could not save");
    setSaved((s) => ({ ...s, [id]: minor }));
    setDrafts((d) => ({ ...d, [id]: toInputString(minor, currency) }));
    note(id, "Saved");
    router.refresh(); // keep the Plan summary's Unallocated Income current
  }

  async function toggle(id: string) {
    const next = !checked[id];
    setChecked((c) => ({ ...c, [id]: next })); // optimistic
    const { ok } = await api(`/api/goals/month/${month}/checkins/${id}`, "PUT", {
      checked: next,
    });
    if (!ok) return setChecked((c) => ({ ...c, [id]: !next })); // revert
    router.refresh(); // keep the Plan summary's Unallocated Income current
  }

  if (lines.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-background shadow-sm p-6 text-sm text-muted">
        No goals yet. Add one below.
      </p>
    );
  }

  const groups = groupByType(lines);
  const total = Object.values(saved).reduce((a, b) => a + b, 0);

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      {groups.map((group) => (
        <Fragment key={group.type}>
          {groups.length > 1 && (
            <li
              aria-hidden="true"
              className="bg-surface-subtle px-4 py-1.5 text-xs font-semibold tracking-wide text-muted"
            >
              {group.label}
            </li>
          )}
          {group.lines.map((l) => (
            <li key={l.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <label className="flex min-w-0 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked[l.id] ?? false}
                    onChange={() => toggle(l.id)}
                    aria-label={`${l.name}: done this month`}
                    className="h-4 w-4 shrink-0 accent-accent"
                  />
                  <span className="truncate font-medium">{l.name}</span>
                </label>
                {editable ? (
                  <input
                    id={`goal-amount-${l.id}`}
                    aria-label={l.name}
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
                    className={`${inputCls} w-32! shrink-0 text-right tabular-nums`}
                  />
                ) : (
                  <span className="w-32 shrink-0 text-right tabular-nums">
                    {formatMoney(saved[l.id] ?? 0, currency)}
                  </span>
                )}
              </div>
              <p
                aria-live="polite"
                className={`mt-1 text-right text-xs ${
                  status[l.id] && status[l.id] !== "Saved" && status[l.id] !== "Saving…"
                    ? "text-danger"
                    : "text-muted"
                }`}
              >
                {status[l.id]}
              </p>
            </li>
          ))}
        </Fragment>
      ))}
      <li className="flex items-center justify-between gap-4 bg-surface px-4 py-3 font-semibold">
        <span>Total</span>
        <span className="tabular-nums">{formatMoney(total, currency)}</span>
      </li>
    </ul>
  );
}
