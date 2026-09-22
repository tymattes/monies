"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CATEGORY_TYPES, TYPE_LABELS, type CategoryType } from "@/lib/categoryTypes";
import { api } from "@/lib/client";
import { buttonCls, inputCls, secondaryButtonCls } from "./ui";

type Category = {
  id: string;
  name: string;
  type: CategoryType;
  archived: boolean;
};

function TypeSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: CategoryType;
  onChange: (type: CategoryType) => void;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as CategoryType)}
      className={`${inputCls} w-auto!`}
    >
      {CATEGORY_TYPES.map((t) => (
        <option key={t} value={t}>
          {TYPE_LABELS[t]}
        </option>
      ))}
    </select>
  );
}

function RenameInput({
  category,
  onSave,
}: {
  category: Category;
  onSave: (name: string) => Promise<void>;
}) {
  const [value, setValue] = useState(category.name);
  return (
    <>
      <label htmlFor={`name-${category.id}`} className="sr-only">
        Name of {category.name}
      </label>
      <input
        id={`name-${category.id}`}
        value={value}
        maxLength={60}
        onChange={(e) => setValue(e.target.value)}
        onBlur={async () => {
          if (value.trim() === category.name) return setValue(category.name);
          await onSave(value);
          setValue(category.name);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className={`${inputCls} w-48!`}
      />
    </>
  );
}

export default function CategoryManager({
  categories,
}: {
  categories: Category[];
}) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<CategoryType>("spending");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const active = categories.filter((c) => !c.archived);
  const archived = categories.filter((c) => c.archived);

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
    run(api(`/api/categories/${id}`, "PATCH", body));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const ok = await run(
      api("/api/categories", "POST", { name: newName, type: newType }),
    );
    if (ok) {
      setNewName("");
      setNewType("spending");
    }
    setBusy(false);
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Categories</h2>
        <p className="text-sm text-muted">
          Renaming applies to every month. Archiving hides a category from this
          month onward; past months keep it.
        </p>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background shadow-sm">
        {active.map((c, i) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
            <RenameInput category={c} onSave={(name) => patch(c.id, { name }).then(() => {})} />
            <label htmlFor={`type-${c.id}`} className="sr-only">
              Type of {c.name}
            </label>
            <TypeSelect
              id={`type-${c.id}`}
              value={c.type}
              onChange={(type) => patch(c.id, { type })}
            />
            <button
              type="button"
              aria-label={`Move ${c.name} up`}
              disabled={i === 0}
              onClick={() => patch(c.id, { position: i - 1 })}
              className={secondaryButtonCls}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={`Move ${c.name} down`}
              disabled={i === active.length - 1}
              onClick={() => patch(c.id, { position: i + 1 })}
              className={secondaryButtonCls}
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Archive ${c.name}? It will be hidden from this month onward.`)) {
                  patch(c.id, { archived: true });
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
        <label htmlFor="new-category" className="sr-only">
          New category name
        </label>
        <input
          id="new-category"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category"
          required
          maxLength={60}
          className={`${inputCls} w-48!`}
        />
        <label htmlFor="new-category-type" className="sr-only">
          New category type
        </label>
        <TypeSelect id="new-category-type" value={newType} onChange={setNewType} />
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
            {archived.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 px-4 py-2"
              >
                <span className="text-muted">
                  {c.name} · {TYPE_LABELS[c.type]}
                </span>
                <button
                  type="button"
                  onClick={() => patch(c.id, { archived: false })}
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
