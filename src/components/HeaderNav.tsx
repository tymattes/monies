"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PLAN_PATHS = ["/budget", "/bills", "/income", "/goals"];

// Top-level destinations: Hub, Plan (Income | Budget | Bills | Goals) and
// Members (spec 015 — Goals moved into the Plan tab group; spec 036 — Hub
// was Overview, appearance only, still the `/` route).
export default function HeaderNav({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const items = [
    { href: "/", label: "Hub", active: pathname === "/" },
    { href: "/income", label: "Plan", active: PLAN_PATHS.includes(pathname) },
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
          className={
            i.active
              ? "font-medium text-foreground"
              : "text-muted hover:text-foreground"
          }
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
