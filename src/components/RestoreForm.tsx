"use client";

import { useState } from "react";
import { api, navigateTo } from "@/lib/client";
import { buttonCls, inputCls, labelCls } from "./ui";

type Mode = "setup" | "overwrite";

// Shared by the setup screen (restoring onto an empty instance) and the
// Household page (an owner overwriting a live instance) — spec 044. The file
// is read and parsed client-side so either path posts the same JSON shape
// the corresponding API route expects.
export default function RestoreForm({
  mode,
  householdName,
}: {
  mode: Mode;
  householdName?: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmed = mode === "setup" || confirmName === householdName;
  const ready = !!file && confirmed;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || busy || !confirmed) return;
    setBusy(true);
    setError(null);

    let backup: unknown;
    try {
      backup = JSON.parse(await file.text());
    } catch {
      setError("That file isn't valid JSON");
      setBusy(false);
      return;
    }

    const { ok, error } =
      mode === "setup"
        ? await api("/api/restore", "POST", backup)
        : await api("/api/household/restore", "POST", {
            confirmHouseholdName: confirmName,
            backup,
          });
    if (!ok) {
      setError(error ?? "Something went wrong");
      setBusy(false);
      return;
    }
    // Restoring can bring back several members; there's no one obvious
    // account to sign in as, so land on sign-in like account deletion does.
    navigateTo("/sign-in?restored=1");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="backup-file" className={labelCls}>
          Backup file
        </label>
        <input
          id="backup-file"
          type="file"
          accept="application/json,.json"
          required
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className={inputCls}
        />
      </div>
      {mode === "overwrite" && (
        <div className="space-y-1">
          <label htmlFor="confirm-household-name" className={labelCls}>
            Type &quot;{householdName}&quot; to confirm
          </label>
          <input
            id="confirm-household-name"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            autoComplete="off"
            className={inputCls}
          />
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button type="submit" disabled={!ready || busy} className={buttonCls}>
        {busy ? "Restoring…" : "Restore from backup"}
      </button>
    </form>
  );
}
