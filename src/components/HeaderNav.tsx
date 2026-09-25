"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PLAN_PATHS = ["/budget", "/bills", "/income", "/goals"];

// Top-level destinations: Hub, Plan (Income | Budget | Bills | Goals) and
// Members (spec 015 — Goals moved into the Plan tab group; spec 036 — Hub
// was Overview, appearance only, still the `/` route). Active state mirrors
// PlanTabs' accent underline (spec 037).
export default function HeaderNav({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const items = [
    { href: "/", label: "Hub", active: pathname === "/" },
    { href: "/income", label: "Plan", hint: "▾", active: PLAN_PATHS.includes(pathname) },
    { href: "/expenses", label: "Expenses", active: pathname === "/expenses" },
    { href: "/members", label: "Members", active: pathname === "/members" },
  ];
  return (
    <nav aria-label="Main" className={`flex items-center ${className}`}>
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={i.active ? "page" : undefined}
          className={`-mb-px border-b-2 px-3 py-2 ${
            i.active
              ? "border-accent font-medium text-foreground"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          {i.label}
          {i.hint && (
            <span aria-hidden className="ml-0.5 text-muted">
              {i.hint}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
