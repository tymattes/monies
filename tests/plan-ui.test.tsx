import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ path: "/budget" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.path }));

import HeaderNav from "@/components/HeaderNav";
import PlanHeader from "@/components/PlanHeader";
import PlanSummary from "@/components/PlanSummary";
import PlanTabs from "@/components/PlanTabs";
import type { Task } from "@/lib/tasks";

const base = {
  month: "2026-09",
  currency: "USD",
  editable: true,
  incomeProvisional: false,
  incomeCents: 927200,
  budgetedCents: 760000,
  billsCents: 271735,
  unallocatedCents: 167200,
  tasks: [] as Task[],
};

const assignTask: Task = {
  code: "unallocated",
  severity: "info",
  message: "$1,672.00 is still unallocated — assign it to a goal.",
  href: "/goals?month=2026-09#assign",
  actionLabel: "Assign",
  amountCents: 167200,
};

// Strips nested tags (e.g. HeaderNav's aria-hidden "Plan" hint span) so
// assertions read the link's accessible label, not its raw inner markup.
function textOnly(html: string) {
  return html.replace(/<[^>]+>/g, "").trim();
}

function labelledCurrent(html: string) {
  return [...html.matchAll(/<a[^>]*aria-current="page"[^>]*>(.*?)<\/a>/g)].map((m) =>
    textOnly(m[1]),
  );
}

describe("PlanSummary", () => {
  it("shows income, budgeted with the bills inside it, and unallocated", () => {
    const html = renderToStaticMarkup(<PlanSummary {...base} />);
    expect(html).toContain("$9,272.00");
    expect(html).toContain("$7,600.00");
    expect(html).toContain("of which bills $2,717.35");
    expect(html).toContain("Unallocated Income");
    expect(html).toContain("$1,672.00");
    expect(html).not.toContain("Over-allocated");
  });

  it("shows no tasks row when there are none", () => {
    const html = renderToStaticMarkup(<PlanSummary {...base} />);
    expect(html).not.toContain('aria-label="Tasks"');
  });

  it("renders each task as a link chip, Assign among them like any other (spec 033)", () => {
    const html = renderToStaticMarkup(<PlanSummary {...base} tasks={[assignTask]} />);
    expect(html).toContain('aria-label="Tasks"');
    expect(html).toMatch(/<a[^>]*href="\/goals\?month=2026-09#assign"[^>]*>Assign income to goal<\/a>/);
  });

  it("names the goal in a check-off chip, so two goals aren't indistinguishable", () => {
    const checkOffs: Task[] = [
      { code: "goal_not_checked", severity: "info", message: "Savings hasn't been checked off yet this month.", href: "/goals", actionLabel: "Check off", goalId: "1", subject: "Savings" },
      { code: "goal_not_checked", severity: "info", message: "Vacation hasn't been checked off yet this month.", href: "/goals", actionLabel: "Check off", goalId: "2", subject: "Vacation" },
    ];
    const html = renderToStaticMarkup(<PlanSummary {...base} tasks={checkOffs} />);
    expect(html).toContain(">Check off Savings goal<");
    expect(html).toContain(">Check off Vacation goal<");
  });

  it("marks a warning task with the error color and a spoken Warning prefix", () => {
    const warning: Task = {
      code: "over_allocated",
      severity: "warning",
      message: "Bills, expenses and checked-off goals exceed your income by $728.00.",
      href: "/budget?month=2026-09",
      actionLabel: "Review budget",
    };
    const html = renderToStaticMarkup(<PlanSummary {...base} tasks={[warning]} />);
    expect(html).toContain("border-danger");
    expect(html).toContain("text-danger");
    expect(html).toContain("Warning: ");
  });

  it("flags over-allocation with the amount and the error color", () => {
    const html = renderToStaticMarkup(<PlanSummary {...base} unallocatedCents={-72800} />);
    expect(html).toContain("Over-allocated by");
    expect(html).toContain("$728.00");
    expect(html).toContain("text-danger");
    expect(html).not.toContain(">Unallocated Income<");
  });

  describe("provisional income (variable income may still arrive)", () => {
    const provisional = { ...base, incomeProvisional: true };

    it("notes that variable income counts once recorded", () => {
      const html = renderToStaticMarkup(<PlanSummary {...provisional} />);
      expect(html).toContain("Variable income counts once you record it.");
      expect(renderToStaticMarkup(<PlanSummary {...base} />)).not.toContain("Variable income counts");
    });

    it("shows being above income plainly, not as an error", () => {
      const html = renderToStaticMarkup(<PlanSummary {...provisional} unallocatedCents={-72800} />);
      expect(html).toContain("Over recorded income by");
      expect(html).toContain("$728.00");
      expect(html).not.toContain("Over-allocated");
      expect(html).not.toContain("text-danger");
    });

    it("is still an error when the income is final", () => {
      const html = renderToStaticMarkup(<PlanSummary {...base} unallocatedCents={-72800} />);
      expect(html).toContain("Over-allocated by");
      expect(html).toContain("text-danger");
      expect(html).not.toContain("Over recorded income");
    });
  });

  it("does not use the error color when within income", () => {
    expect(renderToStaticMarkup(<PlanSummary {...base} />)).not.toContain("text-danger");
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
  it("has exactly Hub, Plan, Expenses and Members", () => {
    nav.path = "/";
    const html = renderToStaticMarkup(<HeaderNav />);
    expect([...html.matchAll(/<a[^>]*>(.*?)<\/a>/g)].map((m) => textOnly(m[1]))).toEqual([
      "Hub", "Plan▾", "Expenses", "Members",
    ]);
    expect(html).toContain('href="/income"'); // Plan opens Income
  });

  it.each([
    ["/", "Hub"],
    ["/budget", "Plan▾"],
    ["/bills", "Plan▾"],
    ["/income", "Plan▾"],
    ["/goals", "Plan▾"],
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
