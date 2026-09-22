import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// AssignUnallocated calls useRouter (for router.refresh() after a successful
// assign); outside the Next app-router runtime that throws "invariant
// expected app router to be mounted", so it needs the same kind of mock
// plan-ui.test.tsx already uses for usePathname.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

import AssignUnallocated from "@/components/AssignUnallocated";

const lines = [
  { id: "c1", name: "Groceries", amountCents: 70000, billsCents: 0 },
  { id: "c2", name: "Housing", amountCents: 180000, billsCents: 150000 },
];
const goals = [
  { id: "g1", name: "Savings", type: "saving" as const, amountCents: 30000 },
  { id: "g2", name: "Credit card", type: "debt payoff" as const, amountCents: 15000 },
];

function panel(overrides: Partial<Parameters<typeof AssignUnallocated>[0]> = {}) {
  return renderToStaticMarkup(
    <AssignUnallocated
      month="2026-09"
      monthName="September 2026"
      currency="USD"
      lines={lines}
      goals={goals}
      unallocated={30000}
      {...overrides}
    />,
  );
}

describe("AssignUnallocated (spec 016)", () => {
  it("shows each category option with its current budgeted amount", () => {
    const html = panel();
    expect(html).toContain("Groceries · $700.00 budgeted");
    expect(html).toContain("Housing · $1,800.00 budgeted");
  });

  it("shows each goal option with its current amount (no 'budgeted' suffix)", () => {
    const html = panel();
    expect(html).toContain("Savings · $300.00<");
    expect(html).toContain("Credit card · $150.00<");
  });

  // The default row always starts pre-filled with the full unallocated
  // amount (spec 014/015 behavior, unchanged here), so a fresh render is
  // always the "equal" case — total === unallocated, left === 0. The
  // under/over states only arise once the amount is edited, which needs a
  // browser to simulate (this project's Vitest UI tests are static
  // renderToStaticMarkup only, no jsdom); see spec 016's Verification.
  it("shows the summary line in the default 'equal' state, undangered", () => {
    const html = panel();
    expect(html).toContain("Assigning $300.00 of $300.00 — $0.00 left");
    expect(html).not.toMatch(/text-danger[^>]*>\s*Assigning/);
  });

  it("hides 'Fill remaining' in the default state (nothing left to fill)", () => {
    const html = panel();
    expect(html).not.toContain("Fill remaining");
  });

  it("lays out each row on an aligned grid", () => {
    const html = panel();
    expect(html).toMatch(/class="[^"]*grid-cols-\[1fr_auto\][^"]*sm:grid-cols-\[1fr_auto_auto_auto\][^"]*"/);
  });

  it("the single-row default still shows just the select and amount controls", () => {
    const html = panel();
    expect(html).toContain('aria-label="Category 1"');
    expect(html).toContain('aria-label="Amount for category 1"');
    expect(html).not.toContain("Remove");
    expect(html).not.toContain("Split evenly");
  });

  it("still preselects the first Saving goal, never Debt payoff", () => {
    const html = panel();
    expect(html).toMatch(/<select[^>]*aria-label="Category 1"[^>]*>[\s\S]*?<option value="goal:g1" selected/);
  });

  it("still shows the existing bottom footnote as the sole aria-live region", () => {
    const html = panel();
    const liveRegions = [...html.matchAll(/aria-live="polite"/g)];
    expect(liveRegions).toHaveLength(1);
    expect(html).toContain("Assigning all of it to September 2026; October 2026 goes back to the earlier amount unless you change it.");
  });
});
