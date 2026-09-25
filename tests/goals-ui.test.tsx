import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// GoalManager calls useRouter() for router.refresh(); outside the Next
// app-router runtime that throws — same mock plan-ui.test.tsx uses.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

import GoalManager from "@/components/GoalManager";

type Goal = Parameters<typeof GoalManager>[0]["goals"][number];

const goal = (over: Partial<Goal> = {}): Goal => ({
  id: "11111111-1111-1111-1111-111111111111",
  name: "Savings",
  type: "saving",
  note: null,
  archived: false,
  ...over,
});

describe("GoalManager notes (spec 040)", () => {
  it("shows an empty note input with a placeholder when a goal has no note", () => {
    const html = renderToStaticMarkup(<GoalManager goals={[goal()]} />);
    expect(html).toContain('placeholder="Add a note (optional)"');
    expect(html).toContain('value=""');
  });

  it("pre-fills the note input with the goal's current note", () => {
    const html = renderToStaticMarkup(<GoalManager goals={[goal({ note: "Kids 529 fund" })]} />);
    expect(html).toContain('value="Kids 529 fund"');
  });

  it("shows a goal's note in the archived summary line", () => {
    const html = renderToStaticMarkup(
      <GoalManager goals={[goal({ archived: true, note: "Paid off in full" })]} />,
    );
    expect(html).toContain("Savings");
    expect(html).toContain("Paid off in full");
  });

  it("omits the note segment for an archived goal with no note", () => {
    const html = renderToStaticMarkup(<GoalManager goals={[goal({ archived: true })]} />);
    expect(html).not.toMatch(/Savings · Saving ·/);
  });
});
