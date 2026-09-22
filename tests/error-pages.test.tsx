import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import GlobalError from "@/app/global-error";
import ErrorPage from "@/app/error";

const noop = () => {};

describe("error page", () => {
  it("explains the failure, offers retry and reload, and shows the error reference", () => {
    const err = Object.assign(new Error("boom"), { digest: "abc123" });
    const html = renderToStaticMarkup(<ErrorPage error={err} reset={noop} />);
    expect(html).toContain("Something went wrong");
    expect(html).toContain("This page couldn&#x27;t load");
    expect(html).toContain("Error reference");
    expect(html).toContain("abc123");
    expect(html).toContain(">Try again<");
    expect(html).toContain(">Reload page<");
    expect(html).toContain('role="alert"');
  });

  it("omits the reference when there is no digest, and never leaks the error message", () => {
    const html = renderToStaticMarkup(<ErrorPage error={new Error("secret db password")} reset={noop} />);
    expect(html).not.toContain("Error reference");
    expect(html).not.toContain("secret db password");
  });

  it("uses only theme tokens (no hardcoded colors)", () => {
    const html = renderToStaticMarkup(<ErrorPage error={new Error("x")} reset={noop} />);
    expect(html).not.toMatch(/#[0-9a-f]{3,8}\b|text-(red|black|white|gray)/i);
  });
});

describe("global error page", () => {
  it("renders its own document with the theme script, so the saved theme still applies", () => {
    const html = renderToStaticMarkup(<GlobalError error={Object.assign(new Error("x"), { digest: "d1" })} reset={noop} />);
    expect(html).toContain("<html");
    expect(html).toContain("<body");
    expect(html).toContain('localStorage.getItem("theme")');
    expect(html).toContain("Something went wrong");
    expect(html).toContain("d1");
    expect(html).toContain(">Try again<");
  });
});
