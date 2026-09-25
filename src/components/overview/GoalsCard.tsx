import Link from "next/link";
import { formatMoney } from "@/lib/money";
import type { Overview } from "@/lib/overview";
import { secondaryButtonCls } from "../ui";

// Tailwind's scanner needs literal class strings, so each type keeps its own
// full class name rather than being built from a shared token.
const TYPE_COLOR = {
  saving: "bg-chart-3",
  "debt payoff": "bg-chart-4",
} as const;

// Only goals funded this month are listed — an unfunded goal has nothing to
// report here (the same "nothing to confirm" reasoning as the goal_not_checked
// attention item).
export default function GoalsCard({
  goals,
  currency,
  href,
}: {
  goals: Overview["goals"];
  currency: string;
  href: string;
}) {
  const money = (c: number) => formatMoney(c, currency);
  const funded = goals.filter((g) => g.amountCents > 0);
  const totalCents = funded.reduce((t, g) => t + g.amountCents, 0);
  const savingCents = funded
    .filter((g) => g.type === "saving")
    .reduce((t, g) => t + g.amountCents, 0);
  const debtPayoffCents = funded
    .filter((g) => g.type === "debt payoff")
    .reduce((t, g) => t + g.amountCents, 0);
  const checkedSavingCents = funded
    .filter((g) => g.type === "saving" && g.checked)
    .reduce((t, g) => t + g.amountCents, 0);
  const checkedDebtPayoffCents = funded
    .filter((g) => g.type === "debt payoff" && g.checked)
    .reduce((t, g) => t + g.amountCents, 0);
  const checkedCents = checkedSavingCents + checkedDebtPayoffCents;
  const pct = (c: number) => (totalCents > 0 ? (c / totalCents) * 100 : 0);

  return (
    <section aria-labelledby="goals-heading" className="space-y-3 rounded-xl border border-border bg-background shadow-sm p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="goals-heading" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          {(savingCents > 0 || debtPayoffCents > 0) && (
            <span aria-hidden="true" className="flex items-center gap-1">
              {savingCents > 0 && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-chart-3" />}
              {debtPayoffCents > 0 && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-chart-4" />}
            </span>
          )}
          Goals
        </h2>
        <Link href={href} className={`${secondaryButtonCls} inline-block`}>
          Check off
        </Link>
      </div>
      {funded.length === 0 ? (
        <p className="text-sm text-muted">No goals funded this month yet.</p>
      ) : (
        <>
          <p className="text-2xl font-semibold">{money(totalCents)}</p>
          <dl className="space-y-1 text-sm">
            {savingCents > 0 && (
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-muted">
                  <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm bg-chart-3" />
                  Saving
                </dt>
                <dd className="tabular-nums">{money(savingCents)}</dd>
              </div>
            )}
            {debtPayoffCents > 0 && (
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-muted">
                  <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm bg-chart-4" />
                  Debt payoff
                </dt>
                <dd className="tabular-nums">{money(debtPayoffCents)}</dd>
              </div>
            )}
          </dl>
          <div>
            <h3 className="mb-1 text-xs text-muted">
              Checked off: {money(checkedCents)} of {money(totalCents)}
            </h3>
            <div
              role="img"
              aria-label={`${money(checkedCents)} checked off of ${money(totalCents)} funded`}
              className="flex h-2 w-full overflow-hidden rounded-full bg-surface-subtle"
            >
              {checkedSavingCents > 0 && (
                <div className="h-full bg-chart-3" style={{ width: `${pct(checkedSavingCents)}%` }} />
              )}
              {checkedDebtPayoffCents > 0 && (
                <div className="h-full bg-chart-4" style={{ width: `${pct(checkedDebtPayoffCents)}%` }} />
              )}
            </div>
          </div>
          <ul className="space-y-1.5 text-sm">
            {funded.map((g) => (
              <li key={g.id} className="flex justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${TYPE_COLOR[g.type]}`} />
                  <span className="min-w-0 truncate">{g.name}</span>
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  {money(g.amountCents)}
                  <span className={`block text-xs ${g.checked ? "text-accent" : "text-muted"}`}>
                    {g.checked ? "✓ Checked off" : "Not checked off yet"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
