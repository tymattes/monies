import type { PlanSummaryData } from "@/lib/plan";
import MonthNav from "./MonthNav";
import PlanSummary from "./PlanSummary";
import PlanTabs from "./PlanTabs";

// Shared by the Budget, Bills and Income pages. A component, not a layout,
// because Next.js layouts cannot read searchParams (the selected month).
// `summary` is omitted on the Budget page, where the editor renders a live
// summary from its own state.
export default function PlanHeader({
  title,
  month,
  now,
  summary,
}: {
  title: "Budget" | "Bills" | "Income" | "Goals";
  month: string;
  now: string;
  summary?: PlanSummaryData;
}) {
  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Plan
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        </div>
        <MonthNav basePath={`/${title.toLowerCase()}`} month={month} now={now} />
      </div>
      <PlanTabs month={month} now={now} />
      {summary && <PlanSummary {...summary} assign="link" />}
    </header>
  );
}
