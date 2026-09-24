import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// AssignUnallocated calls useRouter (for router.refresh() after a successful
// assign); outside the Next app-router runtime that throws "invariant
// expected app router to be mounted", so it needs the same kind of mock
// plan-ui.test.tsx already uses for usePathname.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

import AssignUnallocated from "@/components/AssignUnallocated";

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
      goals={goals}
      unallocated={30000}
      {...overrides}
    />,
  );
}

describe("AssignUnallocated (spec 020)", () => {
  it("offers only goals — no category options", () => {
    const html = panel();
    expect(html).toContain("Savings · $300.00<");
    expect(html).toContain("Credit card · $150.00<");
    expect(html).not.toContain("budgeted");
    expect(html).not.toContain("<optgroup");
  });

  // The default row always starts pre-filled with the full unallocated
  // amount (spec 014/015 behavior, unchanged here), so a fresh render is
  // always the "equal" case — total === unallocated, left === 0. The
  // under/over states only arise once the amount is edited, which needs a
  // browser to simulate (this project's Vitest UI tests are static
  // renderToStaticMarkup only, no jsdom); see spec 020's Verification.
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
    expect(html).toContain('aria-label="Goal 1"');
    expect(html).toContain('aria-label="Amount for goal 1"');
    expect(html).not.toContain("Remove");
    expect(html).not.toContain("Split evenly");
  });

  it("still preselects the first Saving goal, never Debt payoff", () => {
    const html = panel();
    expect(html).toMatch(/<select[^>]*aria-label="Goal 1"[^>]*>[\s\S]*?<option value="g1" selected/);
  });

  it("still shows the existing bottom footnote as the sole aria-live region", () => {
    const html = panel();
    const liveRegions = [...html.matchAll(/aria-live="polite"/g)];
    expect(liveRegions).toHaveLength(1);
    expect(html).toContain("Assigning all of it to September 2026; October 2026 goes back to the earlier amount unless you change it.");
  });

  // spec 026: the claim-at-check-off sentence sits alongside the existing
  // one-month top-up wording, in the same footnote.
  it("explains that assigned money is claimed when the goal is checked off", () => {
    const html = panel();
    expect(html).toContain(
      "It counts against Unallocated Income once you check the goal off on Goals.",
    );
  });
});
