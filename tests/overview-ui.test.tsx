import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AttentionList from "@/components/overview/AttentionList";
import BillsCard from "@/components/overview/BillsCard";
import CashFlowCard from "@/components/overview/CashFlowCard";
import CategoryTable from "@/components/overview/CategoryTable";
import GetStarted from "@/components/overview/GetStarted";
import GoalsCard from "@/components/overview/GoalsCard";
import IncomeCard from "@/components/overview/IncomeCard";
import type { AttentionItem, Overview, OverviewCategory, OverviewGoal } from "@/lib/overview";

const cashFlow = {
  incomeCents: 400000,
  billsCents: 163000,
  expensesCents: 0,
  checkedSavingCents: 0,
  checkedDebtPayoffCents: 0,
  unallocatedCents: 237000,
  overAllocatedCents: 0,
  savingCents: 0,
  debtPayoffCents: 0,
};
const base = { cashFlow, currency: "USD", editable: true, incomeProvisional: false };
const card = (o: Partial<typeof base> = {}, cf: Partial<typeof cashFlow> = {}) =>
  renderToStaticMarkup(
    <CashFlowCard
      overview={{ ...base, ...o, cashFlow: { ...cashFlow, ...cf } }}
      monthName="September 2026"
      assignHref="/income#assign"
    />,
  );

describe("CashFlowCard", () => {
  it("shows the headline numbers and a legend that repeats every amount", () => {
    const html = card();
    expect(html).toContain("Cash flow in September 2026");
    for (const v of ["$4,000.00", "$1,630.00", "$2,370.00"]) {
      expect(html).toContain(v);
    }
    expect(html).toContain("Unallocated Income");
    expect(html).not.toContain("Left after bills");
    expect(html).not.toContain("Over-allocated");
  });

  it("has a text equivalent for the bar and never uses a pie or gauge", () => {
    const html = card();
    expect(html).toMatch(/role="img"[^>]*aria-label="Income \$4,000\.00: \$1,630\.00 bills, \$2,370\.00 unallocated income"/);
    expect(html).not.toMatch(/<svg|<canvas|conic-gradient|radial-gradient/);
  });

  it("scales the segments to the income", () => {
    const html = card();
    expect(html).toContain("width:40.75%"); // bills 1,630 of 4,000
    expect(html).toContain("width:59.25%"); // unallocated 2,370 of 4,000
  });

  it("offers Assign only for an editable month with money left", () => {
    expect(card()).toMatch(/<a[^>]*href="\/income#assign"[^>]*>Assign<\/a>/);
    expect(card({ editable: false })).not.toContain(">Assign<");
    expect(card({}, { unallocatedCents: 0, overAllocatedCents: 0 })).not.toContain(">Assign<");
  });

  it("marks over-allocation with the amount, the income line and the error color", () => {
    const html = card({}, { billsCents: 560000, unallocatedCents: 0, overAllocatedCents: 160000 });
    expect(html).toContain("Over-allocated by");
    expect(html).toContain("$1,600.00");
    expect(html).toContain("over-allocated by $1,600.00"); // in the bar's text equivalent
    expect(html).toContain("bg-danger"); // the income line
    expect(html).not.toContain(">Assign<");
    // The bar is scaled to the commitments (5,600), so the income line (4,000) sits at 71.4%.
    expect(html).toContain("left:71.42857142857143%");
  });

  describe("provisional income", () => {
    const over = { billsCents: 560000, unallocatedCents: 0, overAllocatedCents: 160000 };

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
  });

  it("renders an empty bar without dividing by zero", () => {
    const html = card({}, { incomeCents: 0, billsCents: 0, expensesCents: 0, checkedSavingCents: 0, checkedDebtPayoffCents: 0, unallocatedCents: 0, overAllocatedCents: 0 });
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("Infinity");
  });

  describe("Saving and Debt payoff stats (spec 013)", () => {
    it("shows neither when both are zero", () => {
      const html = card();
      expect(html).not.toContain(">Saving<");
      expect(html).not.toContain(">Debt payoff<");
    });

    it("shows only the nonzero one", () => {
      const savingOnly = card({}, { savingCents: 50000 });
      expect(savingOnly).toContain(">Saving<");
      expect(savingOnly).toContain("$500.00");
      expect(savingOnly).not.toContain(">Debt payoff<");

      const debtOnly = card({}, { debtPayoffCents: 25000 });
      expect(debtOnly).toContain(">Debt payoff<");
      expect(debtOnly).toContain("$250.00");
      expect(debtOnly).not.toContain(">Saving<");
    });

    it("shows both together, without changing any other figure", () => {
      const html = card({}, { savingCents: 50000, debtPayoffCents: 25000 });
      expect(html).toContain(">Saving<");
      expect(html).toContain(">Debt payoff<");
      // The always-present figures are untouched by the new stats.
      expect(html).toContain("$4,000.00"); // income
      expect(html).toContain("$2,370.00"); // unallocated
    });
  });

  describe("the bar draws only checked goal amounts (spec 021)", () => {
    it("an unchecked goal's target contributes nothing to the bar", () => {
      // Saving is funded at $500 but unchecked: the headline stat shows it,
      // the bar segment (checkedSavingCents) does not.
      const html = card({}, { savingCents: 50000, checkedSavingCents: 0 });
      expect(html).toContain(">Saving<"); // the headline stat
      expect(html).not.toContain("bg-chart-3"); // no checked Saving segment in the bar
      expect(html).not.toContain(">Debt payoff<");
    });

    it("checking a goal off draws its segment and moves it out of Unallocated", () => {
      const html = card({}, { savingCents: 50000, checkedSavingCents: 50000, unallocatedCents: 187000 });
      expect(html).toContain("bg-chart-3"); // checked Saving segment
      expect(html).not.toContain("bg-chart-4"); // no checked Debt payoff segment
      expect(html).toMatch(/\$500\.00 saving/);
    });

    it("has a text equivalent naming every nonzero segment, never color alone", () => {
      const html = card(
        {},
        {
          expensesCents: 25000,
          checkedSavingCents: 50000,
          checkedDebtPayoffCents: 25000,
          savingCents: 50000,
          debtPayoffCents: 25000,
          unallocatedCents: 137000,
        },
      );
      const label = html.match(/aria-label="([^"]*)"/)?.[1];
      expect(label).toContain("$500.00 saving");
      expect(label).toContain("$250.00 debt payoff");
      expect(label).toContain("$250.00 expenses");
      expect(label).toContain("unallocated income");
    });

    it("the four segments and unallocated sum to income", () => {
      // bills 1,630 + expenses 250 + checked saving 500 + checked debt 250 + unallocated 1,370 = 4,000.
      const html = card(
        {},
        {
          expensesCents: 25000,
          checkedSavingCents: 50000,
          checkedDebtPayoffCents: 25000,
          savingCents: 50000,
          debtPayoffCents: 25000,
          unallocatedCents: 137000,
        },
      );
      expect(html).toContain("width:40.75%"); // bills 1,630 of 4,000
      expect(html).toContain("width:12.5%"); // saving 500 of 4,000
      expect(html).toContain("width:6.25%"); // debt 250 of 4,000
      expect(html).toContain("width:6.25%"); // expenses 250 of 4,000
      expect(html).toContain("width:34.25%"); // unallocated 1,370 of 4,000
    });
  });
});

const rows: OverviewCategory[] = [
  { id: "1", name: "Housing", budgetedCents: 180000, billsCents: 150000, expensesCents: 0, leftCents: 30000 },
  { id: "2", name: "Utilities", budgetedCents: 35000, billsCents: 42000, expensesCents: 5000, leftCents: -12000 },
  { id: "3", name: "Health", budgetedCents: 0, billsCents: 0, expensesCents: 0, leftCents: 0 },
];

describe("CategoryTable", () => {
  const html = renderToStaticMarkup(<CategoryTable rows={rows} currency="USD" />);

  it("is a real table with a caption, column headers and row headers", () => {
    expect(html).toContain("<caption");
    expect(html).toMatch(/<th scope="col"[^>]*>Category<\/th>/);
    expect(html).toMatch(/<th scope="col"[^>]*>Expenses<\/th>/);
    expect(html).toMatch(/<th scope="row"[^>]*>Housing/);
    expect(html.match(/<th scope="row"/g)?.length).toBe(rows.length + 1); // + the Total row
  });

  it("shows budgeted, bills, expenses and left, with a negative Left in the error color", () => {
    expect(html).toContain("$1,800.00");
    expect(html).toContain("$1,500.00");
    expect(html).toContain("$300.00");
    expect(html).toContain("$50.00"); // Utilities' expenses
    expect(html).toMatch(/text-danger[^>]*>-\$120\.00</); // Utilities: budgeted 350 − bills 420 − expenses 50
    expect(html).not.toMatch(/text-danger[^>]*>\$300\.00</);
  });

  it("totals the columns", () => {
    expect(html).toContain("$2,150.00"); // budgeted 1,800 + 350
    expect(html).toContain("$1,920.00"); // bills 1,500 + 420
    expect(html).toContain("$50.00"); // expenses 0 + 50
    expect(html).toContain("$180.00"); // left = (1,800 + 350) − (1,500 + 420) − 50
  });

  it("draws a budget marker and an over-budget segment only where they apply", () => {
    const utilities = html.split("Utilities")[1].split("</tr>")[0];
    expect(utilities).toContain("bg-danger"); // spend (bills + expenses) past the budget
    const housing = html.split("Housing")[1].split("</tr>")[0];
    expect(housing).not.toContain("bg-danger");
    const health = html.split("Health")[1].split("</tr>")[0];
    expect(health).not.toContain("bg-foreground"); // no budget, so no marker
    expect(html).toContain('aria-hidden="true"'); // bars are decorative; the numbers carry the meaning
  });

  it("describes the bar as actual spend against budget, with no future promise", () => {
    expect(html).toContain("actually spent");
    expect(html).not.toContain("will appear here");
  });

  it("is a flat table, with no type grouping (spec 014: Saving/Debt payoff moved to goals)", () => {
    expect(html).not.toContain("Spending total");
    expect(html).not.toMatch(/<th scope="rowgroup"/);
  });
});

const items: AttentionItem[] = [
  { code: "category_over_budget", severity: "warning", message: "Utilities: is $70.00 over its budget.", href: "/budget", actionLabel: "Adjust budget", categoryId: "c1", amountCents: 7000 },
  { code: "unallocated", severity: "info", message: "$900.00 is not assigned to a category yet.", href: "/income#assign", actionLabel: "Assign", amountCents: 90000 },
];

describe("AttentionList", () => {
  it("renders nothing when there is nothing to say", () => {
    expect(renderToStaticMarkup(<AttentionList items={[]} />)).toBe("");
  });

  it("lists each item with its fix link and speaks a Warning prefix for warnings only", () => {
    const html = renderToStaticMarkup(<AttentionList items={items} />);
    expect(html).toContain("Needs attention");
    expect(html).toMatch(/<a[^>]*href="\/budget"[^>]*>Adjust budget<\/a>/);
    expect(html).toMatch(/<a[^>]*href="\/income#assign"[^>]*>Assign<\/a>/);
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

describe("GoalsCard (spec 015)", () => {
  const goals: OverviewGoal[] = [
    { id: "1", name: "Roth IRA", type: "saving", amountCents: 30000, checked: true },
    { id: "2", name: "Emergency fund", type: "saving", amountCents: 50000, checked: false },
    { id: "3", name: "Credit card", type: "debt payoff", amountCents: 15000, checked: false },
    { id: "4", name: "Unfunded goal", type: "saving", amountCents: 0, checked: false },
  ];

  it("totals only funded goals, split by type", () => {
    const html = renderToStaticMarkup(<GoalsCard goals={goals} currency="USD" href="/goals" />);
    expect(html).toContain("$950.00"); // 300 + 500 + 150, funded only
    expect(html).toContain(">Saving<");
    expect(html).toContain("$800.00"); // 300 + 500
    expect(html).toContain(">Debt payoff<");
    expect(html).toContain("$150.00");
  });

  it("lists each funded goal with its check-off status, and skips unfunded ones", () => {
    const html = renderToStaticMarkup(<GoalsCard goals={goals} currency="USD" href="/goals" />);
    expect(html).toContain("Roth IRA");
    expect(html).toContain("Checked off");
    expect(html).toContain("Emergency fund");
    expect(html).toContain("Credit card");
    expect(html.match(/Not checked off yet/g)?.length).toBe(2); // Emergency fund + Credit card
    expect(html).not.toContain("Unfunded goal");
  });

  it("explains a month with nothing funded", () => {
    const html = renderToStaticMarkup(
      <GoalsCard goals={goals.map((g) => ({ ...g, amountCents: 0 }))} currency="USD" href="/goals" />,
    );
    expect(html).toContain("No goals funded this month yet.");
  });

  it("links Manage to the Goals page", () => {
    const html = renderToStaticMarkup(<GoalsCard goals={goals} currency="USD" href="/goals?month=2026-10" />);
    expect(html).toMatch(/<a[^>]*href="\/goals\?month=2026-10"[^>]*>Manage/);
  });
});

describe("GetStarted", () => {
  it("links the three setup steps in order, keeping the month", () => {
    const html = renderToStaticMarkup(<GetStarted query="?month=2026-10" />);
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(["/income?month=2026-10", "/budget?month=2026-10", "/bills?month=2026-10"]);
  });
});
