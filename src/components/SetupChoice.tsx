"use client";

import { useState } from "react";
import CredentialsForm from "./CredentialsForm";
import RestoreForm from "./RestoreForm";

// The two ways to bring a fresh instance to life (spec 044): a new
// household, or a backup file restored from a previous one.
export default function SetupChoice() {
  const [restoring, setRestoring] = useState(false);
  return (
    <div className="space-y-4">
      {restoring ? <RestoreForm mode="setup" /> : <CredentialsForm mode="setup" />}
      <button
        type="button"
        onClick={() => setRestoring((r) => !r)}
        className="text-sm text-muted underline"
      >
        {restoring ? "Create a new household instead" : "Restore from a backup file instead"}
      </button>
    </div>
  );
}
