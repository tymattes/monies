import Link from "next/link";
import type { Overview } from "@/lib/overview";

// Sits above the rest of Overview until every step is done (spec 031); each
// step's own numbers decide whether it's checked off, so it stays in sync
// with the real data instead of being a one-time dismissal.
export default function GetStarted({
  overview,
  query,
}: {
  overview: Pick<Overview, "income" | "categories" | "bills" | "goals">;
  query: string;
}) {
  const steps = [
    {
      href: `/income${query}`,
      title: "Add your income",
      text: "Salary or other take-home pay, for you and anyone in the household.",
      done: overview.income.totalCents > 0,
    },
    {
      href: `/budget${query}`,
      title: "Set your category budgets",
      text: "Decide how much each category gets each month.",
      done: overview.categories.some((c) => c.budgetedCents > 0),
    },
    {
      href: `/bills${query}`,
      title: "Add your recurring bills",
      text: "Rent, subscriptions and insurance count against their category automatically.",
      done: overview.bills.totalCents > 0,
    },
    {
      href: `/goals${query}`,
      title: "Review your goals",
      text: "Saving or debt-payoff targets you check off each month once the money moves.",
      done: overview.goals.some((g) => g.amountCents > 0),
    },
  ];
  if (steps.every((s) => s.done)) return null;

  return (
    <section aria-labelledby="start-heading" className="space-y-3 rounded-xl border border-border bg-background shadow-sm p-6">
      <h2 id="start-heading" className="text-lg font-semibold tracking-tight">
        Let&apos;s get your month set up
      </h2>
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={s.href} className="flex gap-3">
            <span
              aria-hidden="true"
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
                s.done ? "border-accent text-accent" : "border-border-strong"
              }`}
            >
              {s.done ? "✓" : i + 1}
            </span>
            <div>
              <Link href={s.href} className="font-medium underline underline-offset-2">
                {s.done && <span className="sr-only">Done: </span>}
                {s.title}
              </Link>
              <p className="text-sm text-muted">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
