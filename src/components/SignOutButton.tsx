"use client";

import { api, navigateTo } from "@/lib/client";

export default function SignOutButton() {
  return (
    <button
      type="button"
      className="whitespace-nowrap text-sm text-muted hover:text-foreground"
      onClick={async () => {
        await api("/api/auth/sign-out", "POST");
        navigateTo("/sign-in");
      }}
    >
      Sign out
    </button>
  );
}
