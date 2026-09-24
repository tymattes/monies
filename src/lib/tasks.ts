import type { Budget } from "./budgets";
import { formatMoney } from "./money";
import { currentMonth } from "./months";

export type TaskCode =
  | "over_allocated"
  | "bills_exceed_income"
  | "category_over_budget"
  | "unallocated"
  | "goal_not_checked"
  | "log_expenses"
  | "update_income"
  | "update_bills";

export type Task = {
  code: TaskCode;
  severity: "warning" | "info";
  message: string;
  href: string;
  actionLabel: string;
  amountCents?: number;
  categoryId?: string;
  goalId?: string;
  // A short name for what the task is about (a goal's name, so far) —
  // Overview's full-sentence cards don't need it, but the Plan summary's
  // compact chips do, to tell two goal-check-off chips apart (spec 033).
  subject?: string;
};

// This month's to-do list, built purely from a Budget so Overview's full
// Tasks list (spec 032) and the Plan summary's compact one (spec 033) can
// never drift apart. Warnings first (money already over-committed), then
// what's actionable (Assign, a funded but unchecked goal), then the
// permanent reminders — log expenses, keep income and bills current — shown
// only for the current month, since a past month is for review and a future
// one has nothing to do yet.
export function buildTasks(budget: Budget, month: string): Task[] {
  const money = (cents: number) => formatMoney(cents, budget.currency);
  const q = month === currentMonth() ? "" : `?month=${month}`;
  const tasks: Task[] = [];

  const incomeCents = budget.incomeCents;
  const unallocatedCents = budget.unallocatedCents;
  // Income that may still grow (variable deposits not recorded yet) makes a
  // shortfall informational rather than an error.
  const provisional = budget.incomeProvisional;
  const shortfallSeverity = provisional ? "info" : "warning";
  const note = provisional ? " Variable income counts once you record it." : "";

  if (incomeCents > 0 && unallocatedCents < 0) {
    tasks.push({
      code: "over_allocated",
      severity: shortfallSeverity,
      message: provisional
        ? `Bills, expenses and checked-off goals exceed the income recorded so far by ${money(-unallocatedCents)}.${note}`
        : `Bills, expenses and checked-off goals exceed your income by ${money(-unallocatedCents)}.`,
      href: `/budget${q}`,
      actionLabel: "Review budget",
      amountCents: -unallocatedCents,
    });
  }
  if (incomeCents > 0 && budget.billsTotalCents > incomeCents) {
    tasks.push({
      code: "bills_exceed_income",
      severity: shortfallSeverity,
      message: provisional
        ? `Bills (${money(budget.billsTotalCents)}) are more than the income recorded so far (${money(incomeCents)}).${note}`
        : `Bills (${money(budget.billsTotalCents)}) are more than your income (${money(incomeCents)}).`,
      href: `/bills${q}`,
      actionLabel: "Review bills",
      amountCents: budget.billsTotalCents - incomeCents,
    });
  }
  for (const c of budget.categories) {
    if (c.remainingCents < 0) {
      tasks.push({
        code: "category_over_budget",
        severity: "warning",
        message: `${c.name}: is ${money(-c.remainingCents)} over its budget.`,
        href: `/budget${q}`,
        actionLabel: "Adjust budget",
        amountCents: -c.remainingCents,
        categoryId: c.id,
      });
    }
  }
  if (budget.editable && unallocatedCents > 0) {
    // Assign lives on the Goals page, next to where it's checked off
    // (spec 032).
    tasks.push({
      code: "unallocated",
      severity: "info",
      message: `${money(unallocatedCents)} is still unallocated — assign it to a goal.`,
      href: `/goals${q}#assign`,
      actionLabel: "Assign",
      amountCents: unallocatedCents,
    });
  }
  if (month === currentMonth()) {
    for (const g of budget.goals) {
      if (g.amountCents > 0 && !g.checked) {
        tasks.push({
          code: "goal_not_checked",
          severity: "info",
          message: `${g.name} hasn't been checked off yet this month.`,
          href: "/goals",
          actionLabel: "Check off",
          amountCents: g.amountCents,
          goalId: g.id,
          subject: g.name,
        });
      }
    }
    // Routine upkeep, shown every month regardless of what's already been
    // done — these never resolve (spec 032).
    tasks.push({
      code: "log_expenses",
      severity: "info",
      message: "Log this month's expenses as they happen.",
      href: `/expenses${q}`,
      actionLabel: "Log expense",
    });
    tasks.push({
      code: "update_income",
      severity: "info",
      message: "Keep this month's income up to date.",
      href: `/income${q}`,
      actionLabel: "Update income",
    });
    tasks.push({
      code: "update_bills",
      severity: "info",
      message: "Keep this month's recurring bills up to date.",
      href: `/bills${q}`,
      actionLabel: "Update bills",
    });
  }

  return tasks;
}

// The Plan summary card is a header, not a second Tasks section, so several
// category-over-budget items collapse into one chip there — the only place
// this simplifies what Overview shows in full (spec 033).
export function collapseCategoryOverBudget(tasks: Task[]): Task[] {
  const over = tasks.filter((t) => t.code === "category_over_budget");
  if (over.length <= 1) return tasks;
  const combined: Task = {
    ...over[0],
    message: `${over.length} categories are over budget.`,
    amountCents: over.reduce((sum, t) => sum + (t.amountCents ?? 0), 0),
    categoryId: undefined,
  };
  let replaced = false;
  return tasks.flatMap((t) => {
    if (t.code !== "category_over_budget") return [t];
    if (replaced) return [];
    replaced = true;
    return [combined];
  });
}
