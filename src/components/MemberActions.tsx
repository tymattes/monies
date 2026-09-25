"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Role } from "@/lib/household";
import { api, navigateTo } from "@/lib/client";
import { secondaryButtonCls } from "./ui";

export default function MemberActions({
  userId,
  name,
  role,
  isSelf,
  canRemove,
  canChangeRole,
}: {
  userId: string;
  name: string;
  role: Role;
  isSelf: boolean;
  canRemove: boolean;
  canChangeRole: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!canRemove && !canChangeRole) return null;

  async function remove() {
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
    if (isSelf) return navigateTo("/sign-in"); // your account is gone: full page load
    router.refresh();
  }

  // No new "admin" tier — promoting grants full owner rights (spec 041).
  // No client-side last-owner check, same as `remove` above: the 409 the
  // server sends when this would leave zero owners surfaces through the
  // same inline error paragraph.
  async function changeRole() {
    const next: Role = role === "owner" ? "member" : "owner";
    const prompt =
      next === "owner"
        ? `Make ${name} an owner? They'll be able to do everything you can, including inviting, removing members, and renaming the household.`
        : `Remove owner from ${name}? They'll no longer be able to manage members, invites, or household settings.`;
    if (!window.confirm(prompt)) return;
    setBusy(true);
    setError(null);
    const { ok, error } = await api(`/api/members/${userId}`, "PATCH", { role: next });
    setBusy(false);
    if (!ok) return setError(error ?? "Something went wrong");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {canChangeRole && (
          <button
            type="button"
            disabled={busy}
            onClick={changeRole}
            className={secondaryButtonCls}
          >
            {role === "owner" ? "Remove owner" : "Make owner"}
          </button>
        )}
        {canRemove && (
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className={secondaryButtonCls}
          >
            {isSelf ? "Leave" : "Remove"}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
