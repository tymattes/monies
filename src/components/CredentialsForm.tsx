"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { buttonCls, inputCls, labelCls } from "./ui";

type Mode = "sign-in" | "setup" | "join";

const CONFIG: Record<Mode, { submit: string; ask: (t?: string) => string }> = {
  "sign-in": { submit: "Sign in", ask: () => "/api/auth/sign-in/email" },
  setup: { submit: "Create household", ask: () => "/api/setup" },
  join: {
    submit: "Join household",
    ask: (token) => `/api/join/${encodeURIComponent(token ?? "")}`,
  },
};

// One form for sign-in, first-run setup, and accepting an invite.
export default function CredentialsForm({
  mode,
  token,
}: {
  mode: Mode;
  token?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const needsName = mode !== "sign-in";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = Object.fromEntries(new FormData(e.currentTarget)) as Record<
      string,
      string
    >;
    const { ok, error } = await api(CONFIG[mode].ask(token), "POST", form);
    if (!ok) {
      setError(error ?? "Something went wrong");
      setBusy(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {mode === "setup" && (
        <div className="space-y-1">
          <label htmlFor="householdName" className={labelCls}>
            Household name
          </label>
          <input
            id="householdName"
            name="householdName"
            required
            maxLength={100}
            placeholder="The Smiths"
            className={inputCls}
          />
        </div>
      )}
      {needsName && (
        <div className="space-y-1">
          <label htmlFor="name" className={labelCls}>
            Your name
          </label>
          <input
            id="name"
            name="name"
            required
            maxLength={100}
            autoComplete="name"
            className={inputCls}
          />
        </div>
      )}
      <div className="space-y-1">
        <label htmlFor="email" className={labelCls}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className={inputCls}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="password" className={labelCls}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          className={inputCls}
        />
        {needsName && (
          <p className="text-xs text-foreground/60">At least 8 characters.</p>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className={buttonCls}>
        {busy ? "Please wait…" : CONFIG[mode].submit}
      </button>
    </form>
  );
}
