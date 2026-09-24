import Link from "next/link";
import type { Task } from "@/lib/overview";
import { secondaryButtonCls } from "../ui";

// This month's to-do list: warnings, a funded-but-unchecked goal, assigning
// unallocated income, and the permanent reminders to log expenses and keep
// income and bills current (spec 032). Warnings get an error-colored edge
// and a spoken "Warning" prefix, so they never rely on color.
export default function TaskList({ items }: { items: Task[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="tasks-heading" className="space-y-2">
      <h2 id="tasks-heading" className="text-lg font-semibold tracking-tight">
        Tasks
      </h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={`${item.code}-${item.categoryId ?? item.goalId ?? ""}`}
            className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background shadow-sm border-l-4 px-4 py-3 text-sm ${
              item.severity === "warning" ? "border-l-danger" : "border-l-border-strong"
            }`}
          >
            <span>
              {item.severity === "warning" && <span className="sr-only">Warning: </span>}
              {item.message}
            </span>
            <Link href={item.href} className={`${secondaryButtonCls} inline-block`}>
              {item.actionLabel}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
