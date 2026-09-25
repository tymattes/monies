import type { PlanSummaryData } from "@/lib/plan";
import MonthNav from "./MonthNav";
import PlanSummary from "./PlanSummary";
import PlanTabs from "./PlanTabs";

// One line each, kept in sync with README.md's Philosophy/Features wording
// (spec 042) so the in-app copy and the docs never contradict each other.
const DESCRIPTIONS: Record<"Budget" | "Bills" | "Income" | "Goals", string> = {
  Income: "Everyone's take-home pay this month, fixed or variable.",
  Budget: "How much each category gets this month.",
  Bills: "Recurring costs that count against their category automatically.",
  Goals: "Saving and debt-payoff targets you check off once the money moves.",
};

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
          <p className="text-sm text-muted">{DESCRIPTIONS[title]}</p>
        </div>
        <MonthNav basePath={`/${title.toLowerCase()}`} month={month} now={now} />
      </div>
      <PlanTabs month={month} now={now} />
      {summary && <PlanSummary {...summary} />}
    </header>
  );
}
