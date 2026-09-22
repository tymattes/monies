"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GOAL_TYPES, TYPE_LABELS, type GoalType } from "@/lib/goalTypes";
import { api } from "@/lib/client";
import { buttonCls, inputCls, secondaryButtonCls } from "./ui";

type Goal = { id: string; name: string; type: GoalType; archived: boolean };

function TypeSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: GoalType;
  onChange: (type: GoalType) => void;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as GoalType)}
      className={`${inputCls} w-auto!`}
    >
      {GOAL_TYPES.map((t) => (
        <option key={t} value={t}>
          {TYPE_LABELS[t]}
        </option>
      ))}
    </select>
  );
}

function RenameInput({
  goal,
  onSave,
}: {
  goal: Goal;
  onSave: (name: string) => Promise<void>;
}) {
  const [value, setValue] = useState(goal.name);
  return (
    <>
      <label htmlFor={`name-${goal.id}`} className="sr-only">
        Name of {goal.name}
      </label>
      <input
        id={`name-${goal.id}`}
        value={value}
        maxLength={60}
        onChange={(e) => setValue(e.target.value)}
        onBlur={async () => {
          if (value.trim() === goal.name) return setValue(goal.name);
          await onSave(value);
          setValue(goal.name);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className={`${inputCls} w-48!`}
      />
    </>
  );
}

export default function GoalManager({ goals }: { goals: Goal[] }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<GoalType>("saving");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const active = goals.filter((g) => !g.archived);
  const archived = goals.filter((g) => g.archived);

  async function run(
    request: Promise<{ ok: boolean; error?: string }>,
  ): Promise<boolean> {
    setError(null);
    const { ok, error } = await request;
    if (!ok) setError(error ?? "Something went wrong");
    else router.refresh();
    return ok;
  }

  const patch = (id: string, body: unknown) =>
    run(api(`/api/goals/${id}`, "PATCH", body));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const ok = await run(
      api("/api/goals", "POST", { name: newName, type: newType }),
    );
    if (ok) setNewName("");
    setBusy(false);
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Goals</h2>
        <p className="text-sm text-muted">
          Renaming applies to every month. Archiving hides a goal from this
          month onward; past months keep it.
        </p>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background shadow-sm">
        {active.map((g, i) => (
          <li key={g.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
            <RenameInput goal={g} onSave={(name) => patch(g.id, { name }).then(() => {})} />
            <label htmlFor={`type-${g.id}`} className="sr-only">
              Type of {g.name}
            </label>
            <TypeSelect
              id={`type-${g.id}`}
              value={g.type}
              onChange={(type) => patch(g.id, { type })}
            />
            <button
              type="button"
              aria-label={`Move ${g.name} up`}
              disabled={i === 0}
              onClick={() => patch(g.id, { position: i - 1 })}
              className={secondaryButtonCls}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={`Move ${g.name} down`}
              disabled={i === active.length - 1}
              onClick={() => patch(g.id, { position: i + 1 })}
              className={secondaryButtonCls}
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Archive ${g.name}? It will be hidden from this month onward.`)) {
                  patch(g.id, { archived: true });
                }
              }}
              className={secondaryButtonCls}
            >
              Archive
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="flex max-w-md flex-wrap gap-2">
        <label htmlFor="new-goal" className="sr-only">
          New goal name
        </label>
        <input
          id="new-goal"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New goal"
          required
          maxLength={60}
          className={`${inputCls} w-48!`}
        />
        <label htmlFor="new-goal-type" className="sr-only">
          New goal type
        </label>
        <TypeSelect id="new-goal-type" value={newType} onChange={setNewType} />
        <button type="submit" disabled={busy} className={buttonCls}>
          Add
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {archived.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">
            Archived ({archived.length})
          </summary>
          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-background shadow-sm">
            {archived.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between gap-2 px-4 py-2"
              >
                <span className="text-muted">
                  {g.name} · {TYPE_LABELS[g.type]}
                </span>
                <button
                  type="button"
                  onClick={() => patch(g.id, { archived: false })}
                  className={secondaryButtonCls}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
