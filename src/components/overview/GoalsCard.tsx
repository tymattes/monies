import Link from "next/link";
import { formatMoney } from "@/lib/money";
import type { Overview } from "@/lib/overview";
import { secondaryButtonCls } from "../ui";

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

  return (
    <section aria-labelledby="goals-heading" className="space-y-3 rounded-xl border border-border bg-background shadow-sm p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="goals-heading" className="text-lg font-semibold tracking-tight">Goals</h2>
        <Link href={href} className={`${secondaryButtonCls} inline-block`}>
          Check off
        </Link>
      </div>
      {funded.length === 0 ? (
        <p className="text-sm text-muted">No goals funded this month yet.</p>
      ) : (
        <>
          <p className="text-2xl font-semibold tabular-nums">{money(totalCents)}</p>
          <dl className="space-y-1 text-sm">
            {savingCents > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Saving</dt>
                <dd className="tabular-nums">{money(savingCents)}</dd>
              </div>
            )}
            {debtPayoffCents > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Debt payoff</dt>
                <dd className="tabular-nums">{money(debtPayoffCents)}</dd>
              </div>
            )}
          </dl>
          <ul className="space-y-1 text-sm">
            {funded.map((g) => (
              <li key={g.id} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{g.name}</span>
                <span className="shrink-0 text-right tabular-nums">
                  {money(g.amountCents)}
                  <span className="block text-xs text-muted">
                    {g.checked ? "Checked off" : "Not checked off yet"}
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
