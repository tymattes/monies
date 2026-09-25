"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AssignUnallocated from "../AssignUnallocated";
import { api } from "@/lib/client";
import type { GoalType } from "@/lib/goalTypes";
import { monthLabel } from "@/lib/months";
import type { Task } from "@/lib/overview";
import { secondaryButtonCls } from "../ui";
import TaskQuickBudgetAdjust from "./TaskQuickBudgetAdjust";
import TaskQuickExpense from "./TaskQuickExpense";

type Category = { id: string; name: string; budgetedCents: number };
type Goal = { id: string; name: string; type: GoalType; amountCents: number };

// The four task codes with one specific, submittable action (spec 035).
// Every other code keeps linking out — a review, not a form.
const INLINE_CODES = new Set(["goal_not_checked", "unallocated", "log_expenses", "category_over_budget"]);

function keyOf(item: Task) {
  return `${item.code}-${item.categoryId ?? item.goalId ?? ""}`;
}

// This month's to-do list: warnings, a funded-but-unchecked goal, assigning
// unallocated income, and the permanent reminders to log expenses and keep
// income and bills current (spec 032). A grid of cards, not a stack of full-
// width bars, so several tasks scan at a glance instead of forming a long
// list. Warnings get an error-colored edge and a spoken "Warning" prefix, so
// they never rely on color. Four task codes expand in place into the same
// form their real page uses, so the task can be completed without leaving
// Overview (spec 035); the rest still link out.
export default function TaskList({
  items,
  month,
  currency,
  editable,
  categories,
  goals,
}: {
  items: Task[];
  month: string;
  currency: string;
  editable: boolean;
  categories: Category[];
  goals: Goal[];
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [checkingOff, setCheckingOff] = useState<Set<string>>(new Set());

  if (items.length === 0) return null;

  function toggle(key: string) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function checkOffGoal(key: string, goalId: string) {
    setCheckingOff((s) => new Set(s).add(key));
    const { ok } = await api(`/api/goals/month/${month}/checkins/${goalId}`, "PUT", {
      checked: true,
    });
    if (ok) router.refresh();
    setCheckingOff((s) => {
      const next = new Set(s);
      next.delete(key);
      return next;
    });
  }

  return (
    <section aria-labelledby="tasks-heading" className="space-y-2">
      <h2 id="tasks-heading" className="text-lg font-semibold tracking-tight">
        Tasks
      </h2>
      {/* A CSS multi-column layout, not a grid: cards stack top-to-bottom
          within their own column, so a tall expanded panel only pushes down
          the cards below it in that same column — it can't leave a gap of
          dead space in the row next to it, or stretch/shift unrelated cards
          in other columns (spec 035). break-inside-avoid keeps a single card
          from being split across two columns. */}
      <ul className="columns-1 gap-3 sm:columns-2 lg:columns-3">
        {items.map((item) => {
          const key = keyOf(item);
          // unallocated and category_over_budget only get an inline form
          // when the month is editable — a past month keeps the plain link,
          // since the values behind them are read-only history there.
          const inline =
            INLINE_CODES.has(item.code) &&
            (item.code !== "unallocated" || editable) &&
            (item.code !== "category_over_budget" || editable);
          const category = item.categoryId ? categories.find((c) => c.id === item.categoryId) : undefined;
          const open = expanded.has(key);
          return (
            <li
              key={key}
              className={`mb-3 flex break-inside-avoid flex-col items-start gap-3 rounded-xl border border-border bg-background shadow-sm border-l-4 p-4 text-sm ${
                item.severity === "warning" ? "border-l-danger" : "border-l-border-strong"
              }`}
            >
              {/* min-h-10 reserves two lines' worth of height (text-sm's
                  line-height is 1.25rem) so every collapsed card lines up
                  regardless of message length — the masonry columns below
                  size each card to its own content, so without this a
                  one-line message and a two-line one look uneven. */}
              <span className="min-h-10">
                {item.severity === "warning" && <span className="sr-only">Warning: </span>}
                {item.message}
              </span>
              {!inline ? (
                <Link href={item.href} className={`${secondaryButtonCls} inline-block`}>
                  {item.actionLabel}
                </Link>
              ) : item.code === "goal_not_checked" ? (
                <button
                  type="button"
                  onClick={() => checkOffGoal(key, item.goalId!)}
                  disabled={checkingOff.has(key)}
                  className={`${secondaryButtonCls} inline-block`}
                >
                  {checkingOff.has(key) ? "Checking off…" : item.actionLabel}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => toggle(key)}
                    className={`${secondaryButtonCls} inline-block`}
                  >
                    {item.actionLabel}
                  </button>
                  {open && item.code === "unallocated" && (
                    <AssignUnallocated
                      key={item.amountCents}
                      bare
                      month={month}
                      monthName={monthLabel(month)}
                      currency={currency}
                      goals={goals}
                      unallocated={item.amountCents ?? 0}
                    />
                  )}
                  {open && item.code === "log_expenses" && (
                    <TaskQuickExpense currency={currency} categories={categories} />
                  )}
                  {open && item.code === "category_over_budget" && item.categoryId && (
                    <TaskQuickBudgetAdjust
                      month={month}
                      currency={currency}
                      categoryId={item.categoryId}
                      currentAmountCents={category?.budgetedCents ?? 0}
                    />
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
