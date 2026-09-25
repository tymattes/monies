"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GOAL_TYPES, TYPE_LABELS, type GoalType } from "@/lib/goalTypes";
import { api } from "@/lib/client";
import { buttonCls, inputCls, secondaryButtonCls } from "./ui";

type Goal = {
  id: string;
  name: string;
  type: GoalType;
  note: string | null;
  archived: boolean;
};

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

type GoalBody = { name?: string; type?: GoalType; note?: string | null };

// Name, type and note are drafted locally and committed together on Save,
// rather than each auto-saving on its own blur/change — with three fields
// on one row it was unclear whether an edit had actually landed. The
// `saved` baseline is set once at mount and only updated after a successful
// save (not re-derived from the `goal` prop): after router.refresh() the
// prop drifts, but this row isn't remounted, so re-deriving from props
// would either fight the user's in-progress draft or require an effect
// just to ignore its own writes.
function GoalRow({
  goal,
  index,
  total,
  onSave,
  onMove,
  onArchive,
}: {
  goal: Goal;
  index: number;
  total: number;
  onSave: (id: string, body: GoalBody) => Promise<boolean>;
  onMove: (id: string, position: number) => void;
  onArchive: (goal: Goal) => void;
}) {
  const [name, setName] = useState(goal.name);
  const [type, setType] = useState(goal.type);
  const [note, setNote] = useState(goal.note ?? "");
  const [saved, setSaved] = useState({ name: goal.name, type: goal.type, note: goal.note ?? "" });
  const [saving, setSaving] = useState(false);

  const trimmedNote = note.trim();
  const dirty = name !== saved.name || type !== saved.type || trimmedNote !== saved.note;

  async function save() {
    setSaving(true);
    const body: GoalBody = {};
    if (name !== saved.name) body.name = name;
    if (type !== saved.type) body.type = type;
    if (trimmedNote !== saved.note) body.note = trimmedNote || null;
    const ok = await onSave(goal.id, body);
    if (ok) setSaved({ name, type, note: trimmedNote });
    setSaving(false);
  }

  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`name-${goal.id}`} className="sr-only">
          Name of {goal.name}
        </label>
        <input
          id={`name-${goal.id}`}
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          className={`${inputCls} min-w-40 flex-1`}
        />
        <label htmlFor={`type-${goal.id}`} className="sr-only">
          Type of {goal.name}
        </label>
        <TypeSelect id={`type-${goal.id}`} value={type} onChange={setType} />
        <button
          type="button"
          aria-label={`Move ${goal.name} up`}
          disabled={index === 0}
          onClick={() => onMove(goal.id, index - 1)}
          className={secondaryButtonCls}
        >
          ↑
        </button>
        <button
          type="button"
          aria-label={`Move ${goal.name} down`}
          disabled={index === total - 1}
          onClick={() => onMove(goal.id, index + 1)}
          className={secondaryButtonCls}
        >
          ↓
        </button>
        <button type="button" onClick={() => onArchive(goal)} className={secondaryButtonCls}>
          Archive
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`note-${goal.id}`} className="sr-only">
          Note for {goal.name}
        </label>
        <input
          id={`note-${goal.id}`}
          value={note}
          maxLength={200}
          placeholder="Add a note (optional)"
          onChange={(e) => setNote(e.target.value)}
          className={`${inputCls} min-w-48 flex-1`}
        />
        <button type="button" onClick={save} disabled={!dirty || saving} className={buttonCls}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </li>
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
          <GoalRow
            key={g.id}
            goal={g}
            index={i}
            total={active.length}
            onSave={patch}
            onMove={(id, position) => patch(id, { position })}
            onArchive={(goal) => {
              if (window.confirm(`Archive ${goal.name}? It will be hidden from this month onward.`)) {
                patch(goal.id, { archived: true });
              }
            }}
          />
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
                  {g.note && ` · ${g.note}`}
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
