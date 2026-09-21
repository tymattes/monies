"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { inputCls, secondaryButtonCls } from "./ui";

export default function HouseholdNameForm({ name }: { name: string }) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { ok, error } = await api("/api/household", "PATCH", { name: value });
    setBusy(false);
    if (!ok) return setError(error ?? "Something went wrong");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-sm items-center gap-2">
      <label htmlFor="household-name" className="sr-only">
        Household name
      </label>
      <input
        id="household-name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        required
        maxLength={100}
        className={inputCls}
      />
      <button
        type="submit"
        disabled={busy || value.trim() === name}
        className={secondaryButtonCls}
      >
        Rename
      </button>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}
