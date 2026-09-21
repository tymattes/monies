"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { secondaryButtonCls } from "./ui";

export default function MemberActions({
  userId,
  name,
  isSelf,
  canRemove,
}: {
  userId: string;
  name: string;
  isSelf: boolean;
  canRemove: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!canRemove) return null;

  async function onClick() {
    const prompt = isSelf
      ? "Leave this household? Your account will be deleted."
      : `Remove ${name}? Their account will be deleted.`;
    if (!window.confirm(prompt)) return;
    setBusy(true);
    setError(null);
    const { ok, error } = await api(`/api/members/${userId}`, "DELETE");
    if (!ok) {
      setError(error ?? "Something went wrong");
      setBusy(false);
      return;
    }
    if (isSelf) router.push("/sign-in");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={onClick}
        className={secondaryButtonCls}
      >
        {isSelf ? "Leave" : "Remove"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
