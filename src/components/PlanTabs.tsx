"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/income", label: "Income" },
  { href: "/budget", label: "Budget" },
  { href: "/bills", label: "Bills" },
  { href: "/goals", label: "Goals" },
];

// Income | Budget | Bills | Goals: four views of one monthly plan. Keeps the
// selected month when switching between them.
export default function PlanTabs({ month, now }: { month: string; now: string }) {
  const pathname = usePathname();
  const query = month === now ? "" : `?month=${month}`;
  return (
    <nav aria-label="Plan sections" className="flex gap-1 border-b border-border">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={`${t.href}${query}`}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              active
                ? "border-accent font-medium text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
