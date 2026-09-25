import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// MemberActions calls useRouter() for router.refresh(); outside the Next
// app-router runtime that throws — same mock plan-ui.test.tsx uses.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

import MemberActions from "@/components/MemberActions";

const props = (over: Partial<Parameters<typeof MemberActions>[0]> = {}) => ({
  userId: "11111111-1111-1111-1111-111111111111",
  name: "Mia Member",
  role: "member" as const,
  isSelf: false,
  canRemove: true,
  canChangeRole: true,
  ...over,
});

describe("MemberActions role buttons (spec 041)", () => {
  it("offers to promote a member when the viewer is an owner", () => {
    const html = renderToStaticMarkup(<MemberActions {...props()} />);
    expect(html).toContain("Make owner");
    expect(html).not.toContain("Remove owner");
  });

  it("offers to demote an owner when the viewer is an owner", () => {
    const html = renderToStaticMarkup(<MemberActions {...props({ role: "owner" })} />);
    expect(html).toContain("Remove owner");
    expect(html).not.toContain(">Make owner<");
  });

  it("hides the role button for a viewer who isn't an owner", () => {
    const html = renderToStaticMarkup(<MemberActions {...props({ canChangeRole: false })} />);
    expect(html).not.toContain("Make owner");
    expect(html).not.toContain("Remove owner");
    expect(html).toContain("Remove"); // canRemove is still true
  });

  it("renders nothing when the viewer can neither remove nor change roles", () => {
    const html = renderToStaticMarkup(
      <MemberActions {...props({ canRemove: false, canChangeRole: false })} />,
    );
    expect(html).toBe("");
  });

  it("still labels the remove button Leave for the signed-in user themselves", () => {
    const html = renderToStaticMarkup(
      <MemberActions {...props({ isSelf: true, role: "owner" })} />,
    );
    expect(html).toContain(">Leave<");
    expect(html).toContain("Remove owner"); // an owner can still demote themselves
  });
});
