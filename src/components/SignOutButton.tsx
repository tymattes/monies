"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

export default function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-sm text-muted hover:text-foreground"
      onClick={async () => {
        await api("/api/auth/sign-out", "POST");
        router.push("/sign-in");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
