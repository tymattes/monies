"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { buttonCls, inputCls, secondaryButtonCls } from "./ui";

type Category = { id: string; name: string; archived: boolean };

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
        className={inputCls}
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
    const ok = await run(api("/api/categories", "POST", { name: newName }));
    if (ok) setNewName("");
    setBusy(false);
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Categories</h2>
        <p className="text-sm text-foreground/60">
          Renaming applies to every month. Archiving hides a category from this
          month onward; past months keep it.
        </p>
      </div>

      <ul className="divide-y divide-foreground/10 rounded-lg border border-foreground/10">
        {active.map((c, i) => (
          <li key={c.id} className="flex items-center gap-2 px-4 py-2">
            <RenameInput category={c} onSave={(name) => patch(c.id, { name }).then(() => {})} />
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

      <form onSubmit={add} className="flex max-w-md gap-2">
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
          className={inputCls}
        />
        <button type="submit" disabled={busy} className={buttonCls}>
          Add
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {archived.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-foreground/70">
            Archived ({archived.length})
          </summary>
          <ul className="mt-2 divide-y divide-foreground/10 rounded-lg border border-foreground/10">
            {archived.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 px-4 py-2"
              >
                <span className="text-foreground/70">{c.name}</span>
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
