import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AttentionList from "@/components/overview/AttentionList";
import BillsCard from "@/components/overview/BillsCard";
import CashFlowCard from "@/components/overview/CashFlowCard";
import CategoryTable from "@/components/overview/CategoryTable";
import GetStarted from "@/components/overview/GetStarted";
import IncomeCard from "@/components/overview/IncomeCard";
import type { AttentionItem, Overview } from "@/lib/overview";

const cashFlow = {
  incomeCents: 400000,
  billsWithinBudgetCents: 160000,
  restOfBudgetCents: 100000,
  unallocatedCents: 140000,
  overAllocatedCents: 0,
  leftAfterBillsCents: 237000,
};
const base = { cashFlow, currency: "USD", editable: true, incomeProvisional: false };
const card = (o: Partial<typeof base> = {}, cf: Partial<typeof cashFlow> = {}) =>
  renderToStaticMarkup(
    <CashFlowCard
      overview={{ ...base, ...o, cashFlow: { ...cashFlow, ...cf } }}
      billsTotalCents={163000}
      monthName="September 2026"
      assignHref="/budget#assign"
    />,
  );

describe("CashFlowCard", () => {
  it("shows the headline numbers and a legend that repeats every amount", () => {
    const html = card();
    expect(html).toContain("Cash flow in September 2026");
    for (const v of ["$4,000.00", "$1,630.00", "$2,370.00", "$1,400.00", "$1,600.00", "$1,000.00"]) {
      expect(html).toContain(v);
    }
    expect(html).toContain("Left after bills");
    expect(html).toContain("Unallocated");
    expect(html).not.toContain("Over-allocated");
  });

  it("has a text equivalent for the bar and never uses a pie or gauge", () => {
    const html = card();
    expect(html).toMatch(/role="img"[^>]*aria-label="Income \$4,000\.00: \$1,600\.00 bills within budget, \$1,000\.00 rest of budget, \$1,400\.00 unallocated"/);
    expect(html).not.toMatch(/<svg|<canvas|conic-gradient|radial-gradient/);
  });

  it("scales the segments to the income", () => {
    const html = card();
    expect(html).toContain("width:40%"); // bills 1,600 of 4,000
    expect(html).toContain("width:25%"); // rest 1,000
    expect(html).toContain("width:35%"); // unallocated 1,400
  });

  it("offers Assign only for an editable month with money left", () => {
    expect(card()).toMatch(/<a[^>]*href="\/budget#assign"[^>]*>Assign<\/a>/);
    expect(card({ editable: false })).not.toContain(">Assign<");
    expect(card({}, { unallocatedCents: 0, overAllocatedCents: 0 })).not.toContain(">Assign<");
  });

  it("marks over-allocation with the amount, the income line and the error color", () => {
    const html = card({}, { restOfBudgetCents: 400000, unallocatedCents: 0, overAllocatedCents: 160000 });
    expect(html).toContain("Over-allocated by");
    expect(html).toContain("$1,600.00");
    expect(html).toContain("over-allocated by $1,600.00"); // in the bar's text equivalent
    expect(html).toContain("bg-danger"); // the income line
    expect(html).not.toContain(">Assign<");
    // The bar is scaled to the budget (5,600), so the income line (4,000) sits at 71.4%.
    expect(html).toContain("left:71.42857142857143%");
  });

  describe("provisional income", () => {
    const over = { restOfBudgetCents: 400000, unallocatedCents: 0, overAllocatedCents: 160000 };

    it("shows a shortfall plainly, with the variable-income note and no error color", () => {
      const html = card({ incomeProvisional: true }, over);
      expect(html).toContain("Variable income counts once you record it.");
      expect(html).toContain("Over recorded income by");
      expect(html).toContain("Above recorded income (past the income line)");
      expect(html).toContain("above recorded income by $1,600.00"); // the bar's text equivalent
      expect(html).not.toContain("Over-allocated");
      expect(html).not.toContain("text-danger");
      expect(html).not.toContain("bg-danger");
      expect(html).toContain("bg-foreground"); // the income line is still drawn, neutrally
    });

    it("keeps the error styling when the income is final", () => {
      const html = card({}, over);
      expect(html).toContain("Over-allocated by");
      expect(html).toContain("text-danger");
      expect(html).toContain("bg-danger");
      expect(html).not.toContain("Variable income counts");
    });

    it("softens bills that exceed the recorded income", () => {
      const html = card({ incomeProvisional: true }, { leftAfterBillsCents: -50000 });
      expect(html).toContain("Bills exceed recorded income by");
      expect(html).not.toContain("text-danger");
      expect(card({}, { leftAfterBillsCents: -50000 })).toContain("text-danger");
    });
  });

  it("flags bills that exceed income", () => {
    const html = card({}, { leftAfterBillsCents: -50000 });
    expect(html).toContain("Bills exceed income by");
    expect(html).toContain("$500.00");
  });

  it("renders an empty bar without dividing by zero", () => {
    const html = card({}, { incomeCents: 0, billsWithinBudgetCents: 0, restOfBudgetCents: 0, unallocatedCents: 0, overAllocatedCents: 0, leftAfterBillsCents: 0 });
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("Infinity");
  });
});

const rows = [
  { id: "1", name: "Housing", budgetedCents: 180000, billsCents: 150000, leftCents: 30000 },
  { id: "2", name: "Utilities", budgetedCents: 35000, billsCents: 42000, leftCents: -7000 },
  { id: "3", name: "Health", budgetedCents: 0, billsCents: 0, leftCents: 0 },
];

describe("CategoryTable", () => {
  const html = renderToStaticMarkup(<CategoryTable rows={rows} currency="USD" />);

  it("is a real table with a caption, column headers and row headers", () => {
    expect(html).toContain("<caption");
    expect(html).toMatch(/<th scope="col"[^>]*>Category<\/th>/);
    expect(html).toMatch(/<th scope="row"[^>]*>Housing/);
    expect(html.match(/<th scope="row"/g)?.length).toBe(rows.length + 1); // + the Total row
  });

  it("shows budgeted, bills and left, with a negative Left in the error color", () => {
    expect(html).toContain("$1,800.00");
    expect(html).toContain("$1,500.00");
    expect(html).toContain("$300.00");
    expect(html).toMatch(/text-danger[^>]*>-\$70\.00</);
    expect(html).not.toMatch(/text-danger[^>]*>\$300\.00</);
  });

  it("totals the columns", () => {
    expect(html).toContain("$2,150.00"); // budgeted 1,800 + 350
    expect(html).toContain("$1,920.00"); // bills 1,500 + 420
    expect(html).toContain("$230.00"); // left = budgeted - bills
  });

  it("draws a budget marker and an over-budget segment only where they apply", () => {
    const utilities = html.split("Utilities")[1].split("</tr>")[0];
    expect(utilities).toContain("bg-danger"); // bills past the budget
    const housing = html.split("Housing")[1].split("</tr>")[0];
    expect(housing).not.toContain("bg-danger");
    const health = html.split("Health")[1].split("</tr>")[0];
    expect(health).not.toContain("bg-foreground"); // no budget, so no marker
    expect(html).toContain('aria-hidden="true"'); // bars are decorative; the numbers carry the meaning
  });

  it("does not offer a Spent column yet", () => {
    expect(html).not.toMatch(/>Spent</);
  });
});

const items: AttentionItem[] = [
  { code: "category_bills_over_budget", severity: "warning", message: "Utilities: bills are $70.00 over its budget.", href: "/budget", actionLabel: "Adjust budget", categoryId: "c1", amountCents: 7000 },
  { code: "unallocated", severity: "info", message: "$900.00 is not assigned to a category yet.", href: "/budget#assign", actionLabel: "Assign", amountCents: 90000 },
];

describe("AttentionList", () => {
  it("renders nothing when there is nothing to say", () => {
    expect(renderToStaticMarkup(<AttentionList items={[]} />)).toBe("");
  });

  it("lists each item with its fix link and speaks a Warning prefix for warnings only", () => {
    const html = renderToStaticMarkup(<AttentionList items={items} />);
    expect(html).toContain("Needs attention");
    expect(html).toMatch(/<a[^>]*href="\/budget"[^>]*>Adjust budget<\/a>/);
    expect(html).toMatch(/<a[^>]*href="\/budget#assign"[^>]*>Assign<\/a>/);
    expect(html.match(/Warning: /g)?.length).toBe(1);
    expect(html).toContain("border-l-danger");
  });
});

const income: Overview["income"] = {
  totalCents: 600000,
  fixedCents: 500000,
  variableCents: 100000,
  byMember: [
    { memberId: "a", name: "Olive Owner", totalCents: 500000 },
    { memberId: "b", name: "Mia Member", totalCents: 100000 },
  ],
};

describe("IncomeCard", () => {
  it("shows the total, the fixed and variable split and each member", () => {
    const html = renderToStaticMarkup(<IncomeCard income={income} currency="USD" href="/income" />);
    for (const v of ["$6,000.00", "$5,000.00", "$1,000.00", "Olive Owner", "Mia Member"]) expect(html).toContain(v);
    expect(html).toMatch(/<a[^>]*href="\/income"/);
  });

  it("explains an empty month", () => {
    const html = renderToStaticMarkup(<IncomeCard income={{ ...income, totalCents: 0, fixedCents: 0, variableCents: 0 }} currency="USD" href="/income" />);
    expect(html).toContain("No income recorded for this month yet.");
  });
});

describe("BillsCard", () => {
  const bills: Overview["bills"] = {
    totalCents: 194599,
    byCategory: [{ categoryId: "h", name: "Housing", totalCents: 150000 }],
    largest: [
      { id: "1", name: "Rent", categoryName: "Housing", monthlyCents: 150000, amountCents: 150000, intervalMonths: 1 },
      { id: "2", name: "Cloud storage", categoryName: "Other", monthlyCents: 1000, amountCents: 12000, intervalMonths: 12 },
    ],
  };

  it("shows the monthly total and gives yearly bills their real charge", () => {
    const html = renderToStaticMarkup(<BillsCard bills={bills} currency="USD" href="/bills" />);
    expect(html).toContain("$1,945.99");
    expect(html).toContain("Rent");
    expect(html).toContain("$120.00 every year");
    expect(html).not.toContain("$1,500.00 every"); // monthly bills need no note
  });

  it("explains a month with no bills", () => {
    const html = renderToStaticMarkup(<BillsCard bills={{ totalCents: 0, byCategory: [], largest: [] }} currency="USD" href="/bills" />);
    expect(html).toContain("No recurring bills yet.");
  });
});

describe("GetStarted", () => {
  it("links the three setup steps in order, keeping the month", () => {
    const html = renderToStaticMarkup(<GetStarted query="?month=2026-10" />);
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(["/income?month=2026-10", "/budget?month=2026-10", "/bills?month=2026-10"]);
  });
});
