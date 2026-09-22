import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ path: "/budget" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.path }));

import HeaderNav from "@/components/HeaderNav";
import PlanHeader from "@/components/PlanHeader";
import PlanSummary from "@/components/PlanSummary";
import PlanTabs from "@/components/PlanTabs";

const base = {
  month: "2026-09",
  currency: "USD",
  editable: true,
  incomeProvisional: false,
  incomeCents: 927200,
  budgetedCents: 760000,
  billsCents: 271735,
  unallocatedCents: 167200,
};

function labelledCurrent(html: string) {
  return [...html.matchAll(/<a[^>]*aria-current="page"[^>]*>([^<]*)<\/a>/g)].map((m) => m[1]);
}

describe("PlanSummary", () => {
  it("shows income, budgeted with the bills inside it, and unallocated", () => {
    const html = renderToStaticMarkup(<PlanSummary {...base} assign="link" />);
    expect(html).toContain("$9,272.00");
    expect(html).toContain("$7,600.00");
    expect(html).toContain("of which bills $2,717.35");
    expect(html).toContain("Unallocated Income");
    expect(html).toContain("$1,672.00");
    expect(html).not.toContain("Over-allocated");
  });

  it("links Assign to the Income page's panel from other pages", () => {
    const html = renderToStaticMarkup(<PlanSummary {...base} assign="link" />);
    expect(html).toMatch(/<a[^>]*href="\/income\?month=2026-09#assign"[^>]*>Assign<\/a>/);
  });

  it("uses a button that scrolls to the panel on the Budget page", () => {
    const html = renderToStaticMarkup(<PlanSummary {...base} assign="scroll" />);
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>Assign<\/button>/);
    expect(html).not.toContain("#assign");
  });

  it.each([
    ["the month is read-only", { editable: false }],
    ["nothing is unallocated", { unallocatedCents: 0 }],
    ["committed more than income", { unallocatedCents: -72800 }],
  ])("hides Assign when %s", (_label, overrides) => {
    for (const mode of ["link", "scroll"] as const) {
      const html = renderToStaticMarkup(<PlanSummary {...base} {...overrides} assign={mode} />);
      expect(html).not.toContain(">Assign<");
    }
  });

  it("flags over-allocation with the amount and the error color", () => {
    const html = renderToStaticMarkup(<PlanSummary {...base} unallocatedCents={-72800} assign="link" />);
    expect(html).toContain("Over-allocated by");
    expect(html).toContain("$728.00");
    expect(html).toContain("text-danger");
    expect(html).not.toContain(">Unallocated Income<");
  });

  describe("provisional income (variable income may still arrive)", () => {
    const provisional = { ...base, incomeProvisional: true };

    it("notes that variable income counts once recorded", () => {
      const html = renderToStaticMarkup(<PlanSummary {...provisional} assign="link" />);
      expect(html).toContain("Variable income counts once you record it.");
      expect(renderToStaticMarkup(<PlanSummary {...base} assign="link" />)).not.toContain("Variable income counts");
    });

    it("shows being above income plainly, not as an error", () => {
      const html = renderToStaticMarkup(<PlanSummary {...provisional} unallocatedCents={-72800} assign="link" />);
      expect(html).toContain("Over recorded income by");
      expect(html).toContain("$728.00");
      expect(html).not.toContain("Over-allocated");
      expect(html).not.toContain("text-danger");
    });

    it("is still an error when the income is final", () => {
      const html = renderToStaticMarkup(<PlanSummary {...base} unallocatedCents={-72800} assign="link" />);
      expect(html).toContain("Over-allocated by");
      expect(html).toContain("text-danger");
      expect(html).not.toContain("Over recorded income");
    });

    it("keeps Assign hidden when over, and shown when money is left", () => {
      expect(renderToStaticMarkup(<PlanSummary {...provisional} unallocatedCents={-72800} assign="link" />)).not.toContain(">Assign<");
      expect(renderToStaticMarkup(<PlanSummary {...provisional} assign="link" />)).toContain(">Assign<");
    });
  });

  it("does not use the error color when within income", () => {
    expect(renderToStaticMarkup(<PlanSummary {...base} assign="link" />)).not.toContain("text-danger");
  });
});

describe("PlanTabs", () => {
  it.each([
    ["/budget", "Budget"],
    ["/bills", "Bills"],
    ["/income", "Income"],
    ["/goals", "Goals"],
  ])("marks only the current page on %s", (path, label) => {
    nav.path = path;
    const html = renderToStaticMarkup(<PlanTabs month="2026-09" now="2026-09" />);
    expect(labelledCurrent(html)).toEqual([label]);
    expect(html).toContain('aria-label="Plan sections"');
  });

  it("links to all four pages, keeping the month only when it is not the current one", () => {
    nav.path = "/budget";
    const current = renderToStaticMarkup(<PlanTabs month="2026-09" now="2026-09" />);
    expect(current).toContain('href="/budget"');
    expect(current).toContain('href="/bills"');
    expect(current).toContain('href="/income"');
    expect(current).toContain('href="/goals"');
    expect(current).not.toContain("?month=");

    const other = renderToStaticMarkup(<PlanTabs month="2026-11" now="2026-09" />);
    expect(other).toContain('href="/budget?month=2026-11"');
    expect(other).toContain('href="/bills?month=2026-11"');
    expect(other).toContain('href="/income?month=2026-11"');
    expect(other).toContain('href="/goals?month=2026-11"');
  });
});

describe("HeaderNav", () => {
  it("has exactly Overview, Plan, Expenses and Members", () => {
    nav.path = "/";
    const html = renderToStaticMarkup(<HeaderNav />);
    expect([...html.matchAll(/<a[^>]*>([^<]*)<\/a>/g)].map((m) => m[1])).toEqual([
      "Overview", "Plan", "Expenses", "Members",
    ]);
    expect(html).toContain('href="/budget"'); // Plan opens Budget
  });

  it.each([
    ["/", "Overview"],
    ["/budget", "Plan"],
    ["/bills", "Plan"],
    ["/income", "Plan"],
    ["/goals", "Plan"],
    ["/expenses", "Expenses"],
    ["/members", "Members"],
  ])("highlights the right destination on %s", (path, label) => {
    nav.path = path;
    expect(labelledCurrent(renderToStaticMarkup(<HeaderNav />))).toEqual([label]);
  });
});

describe("PlanHeader", () => {
  it("shows the page title, a Plan label, tabs and the month switcher", () => {
    nav.path = "/bills";
    const html = renderToStaticMarkup(<PlanHeader title="Bills" month="2026-09" now="2026-09" />);
    expect(html).toMatch(/<h1[^>]*>Bills<\/h1>/);
    expect(html).toContain(">Plan<");
    expect(html).toContain('aria-label="Plan sections"');
    expect(html).toContain('aria-label="Month"');
    expect(html).toContain('href="/bills?month=2026-08"'); // previous month stays on this page
  });

  it("renders Goals like any other Plan tab, with a summary bar (spec 015)", () => {
    nav.path = "/goals";
    const html = renderToStaticMarkup(
      <PlanHeader title="Goals" month="2026-09" now="2026-09" summary={base} />,
    );
    expect(html).toMatch(/<h1[^>]*>Goals<\/h1>/);
    expect(html).toContain('aria-label="Plan sections"');
    expect(html).toContain("Plan summary");
  });

  it("renders the summary only when given one", () => {
    nav.path = "/income";
    const without = renderToStaticMarkup(<PlanHeader title="Income" month="2026-09" now="2026-09" />);
    expect(without).not.toContain("Plan summary");
    const withSummary = renderToStaticMarkup(
      <PlanHeader title="Income" month="2026-09" now="2026-09" summary={base} />,
    );
    expect(withSummary).toContain("Plan summary");
    expect(withSummary).toContain("$1,672.00");
  });
});
