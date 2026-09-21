"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { buttonCls, inputCls, secondaryButtonCls } from "./ui";

type Pending = { id: string; createdAt: string; expiresAt: string };

export default function InviteManager({ pending }: { pending: Pending[] }) {
  const router = useRouter();
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    setCopied(false);
    const { ok, data, error } = await api("/api/invites", "POST");
    setBusy(false);
    if (!ok) return setError(error ?? "Something went wrong");
    setLink(`${window.location.origin}${data.path as string}`);
    router.refresh();
  }

  async function revoke(id: string) {
    setError(null);
    const { ok, error } = await api(`/api/invites/${id}`, "DELETE");
    if (!ok) return setError(error ?? "Something went wrong");
    router.refresh();
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setError("Couldn't copy automatically. Select the link and copy it.");
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Invites</h2>
          <p className="text-sm text-muted">
            Links work once and expire after 7 days.
          </p>
        </div>
        <button
          type="button"
          onClick={create}
          disabled={busy}
          className={buttonCls}
        >
          Create invite link
        </button>
      </div>

      {link && (
        <div className="space-y-2 rounded-lg border border-foreground/10 p-4">
          <p className="text-sm">
            Share this link. It won&apos;t be shown again after you leave this
            page.
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={link}
              aria-label="Invite link"
              onFocus={(e) => e.currentTarget.select()}
              className={inputCls}
            />
            <button type="button" onClick={copy} className={secondaryButtonCls}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {pending.length > 0 && (
        <ul className="divide-y divide-foreground/10 rounded-lg border border-foreground/10">
          {pending.map((i) => (
            <li
              key={i.id}
              className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
            >
              <span>
                Created {i.createdAt}
                <span className="text-muted">
                  {" "}
                  · expires {i.expiresAt}
                </span>
              </span>
              <button
                type="button"
                onClick={() => revoke(i.id)}
                className={secondaryButtonCls}
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
