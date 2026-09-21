import Link from "next/link";

// Shown instead of the numbers when a household has nothing in it yet.
export default function GetStarted({ query }: { query: string }) {
  const steps = [
    { href: `/income${query}`, title: "Add your income", text: "Salary or other take-home pay, for you and anyone in the household." },
    { href: `/budget${query}`, title: "Set your category budgets", text: "Decide how much each category gets each month." },
    { href: `/bills${query}`, title: "Add your recurring bills", text: "Rent, subscriptions and insurance count against their category automatically." },
  ];
  return (
    <section aria-labelledby="start-heading" className="space-y-3 rounded-lg border border-border p-6">
      <h2 id="start-heading" className="text-lg font-semibold tracking-tight">
        Let&apos;s get your month set up
      </h2>
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={s.href} className="flex gap-3">
            <span
              aria-hidden="true"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border-strong text-xs"
            >
              {i + 1}
            </span>
            <div>
              <Link href={s.href} className="font-medium underline underline-offset-2">
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
