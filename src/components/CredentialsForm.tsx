"use client";

import { useState } from "react";
import { api, navigateTo } from "@/lib/client";
import { buttonCls, inputCls, labelCls } from "./ui";

const CURRENCIES = Intl.supportedValuesOf("currency");
const currencyName = new Intl.DisplayNames("en", { type: "currency" });

const COMMON_CODES = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "JPY",
  "CHF",
  "CNY",
  "INR",
  "MXN",
  "BRL",
  "NZD",
];
const COMMON_CURRENCIES = COMMON_CODES.filter((code) =>
  CURRENCIES.includes(code),
);
const REST_CURRENCIES = CURRENCIES.filter(
  (code) => !COMMON_CURRENCIES.includes(code),
);

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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const needsName = mode !== "sign-in";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
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
    // A full page load, so the header shows the signed-in user (see navigateTo).
    // The button stays busy while the browser navigates.
    navigateTo("/");
  }

  return (
    <form
      onSubmit={onSubmit}
      onKeyDown={(e) => {
        // Submit explicitly on Enter instead of relying on the browser's
        // implicit submission, which some browsers skip (autofill, password
        // managers). Cancelling the key event prevents a second, implicit one.
        if (
          e.key === "Enter" &&
          !e.nativeEvent.isComposing &&
          e.target instanceof HTMLInputElement
        ) {
          e.preventDefault();
          e.currentTarget.requestSubmit();
        }
      }}
      className="space-y-4"
    >
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
      {mode === "setup" && (
        <div className="space-y-1">
          <label htmlFor="currency" className={labelCls}>
            Currency
          </label>
          <select
            id="currency"
            name="currency"
            defaultValue="USD"
            className={inputCls}
          >
            <optgroup label="Common">
              {COMMON_CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code} · {currencyName.of(code)}
                </option>
              ))}
            </optgroup>
            <optgroup label="All currencies">
              {REST_CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code} · {currencyName.of(code)}
                </option>
              ))}
            </optgroup>
          </select>
          <p className="text-xs text-muted">
            Used for every amount in this household. Can&apos;t be changed later
            in this version.
          </p>
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
          <p className="text-xs text-muted">At least 8 characters.</p>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className={buttonCls}>
        {busy ? "Please wait…" : CONFIG[mode].submit}
      </button>
    </form>
  );
}
