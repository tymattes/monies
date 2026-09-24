import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// ExpenseLog calls useRouter (for router.refresh() after add/delete); outside
// the Next app-router runtime that throws "invariant expected app router to
// be mounted", so it needs the same mock plan-ui.test.tsx and
// assign-ui.test.tsx use.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

import ExpenseLog from "@/components/ExpenseLog";

const categories = [{ id: "c1", name: "Groceries" }];

function log() {
  return renderToStaticMarkup(
    <ExpenseLog month="2026-09" currency="USD" categories={categories} expenses={[]} />,
  );
}

describe("ExpenseLog (spec 027)", () => {
  it("keeps the Description field inside the quick-entry form", () => {
    const html = log();
    const formMatch = html.match(/<form[^>]*>[\s\S]*?<\/form>/);
    expect(formMatch).not.toBeNull();
    expect(formMatch![0]).toContain('id="expense-description"');
  });

  it("orders the controls Category, Amount, Date, Description, Add expense", () => {
    const html = log();
    const order = [
      "expense-category",
      "expense-amount",
      "expense-date",
      "expense-description",
      ">Add expense<",
    ].map((needle) => html.indexOf(needle));
    expect(order.every((i) => i !== -1)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});
