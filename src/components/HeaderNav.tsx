"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PLAN_PATHS = ["/budget", "/bills", "/income"];

// Top-level destinations: Overview, Plan (Budget | Bills | Income) and Members.
export default function HeaderNav({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const items = [
    { href: "/", label: "Overview", active: pathname === "/" },
    { href: "/budget", label: "Plan", active: PLAN_PATHS.includes(pathname) },
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
