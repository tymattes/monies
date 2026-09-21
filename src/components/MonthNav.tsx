import Link from "next/link";
import { addMonths, monthLabel } from "@/lib/months";
import { navCls } from "./ui";

export default function MonthNav({
  basePath,
  month,
  now,
}: {
  basePath: string;
  month: string;
  now: string;
}) {
  return (
    <nav aria-label="Month" className="flex items-center gap-2">
      <Link
        href={`${basePath}?month=${addMonths(month, -1)}`}
        className={navCls}
        aria-label="Previous month"
      >
        ←
      </Link>
      <span className="min-w-36 text-center text-sm font-medium">
        {monthLabel(month)}
      </span>
      <Link
        href={`${basePath}?month=${addMonths(month, 1)}`}
        className={navCls}
        aria-label="Next month"
      >
        →
      </Link>
      {month !== now && (
        <Link href={basePath} className={navCls}>
          This month
        </Link>
      )}
    </nav>
  );
}
