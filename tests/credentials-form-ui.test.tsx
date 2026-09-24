import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import CredentialsForm from "@/components/CredentialsForm";

function setup() {
  return renderToStaticMarkup(<CredentialsForm mode="setup" />);
}

describe("CredentialsForm currency picker (spec 028)", () => {
  it("puts the Common group before All currencies, with USD selected", () => {
    const html = setup();
    const selectMatch = html.match(/<select id="currency"[\s\S]*?<\/select>/);
    expect(selectMatch).not.toBeNull();
    const select = selectMatch![0];

    const commonIndex = select.indexOf('label="Common"');
    const allIndex = select.indexOf('label="All currencies"');
    expect(commonIndex).toBeGreaterThan(-1);
    expect(allIndex).toBeGreaterThan(commonIndex);

    expect(select).toContain('value="USD" selected=""');
  });

  it("renders every currency code exactly once", () => {
    const html = setup();
    const selectMatch = html.match(/<select id="currency"[\s\S]*?<\/select>/);
    const select = selectMatch![0];
    const codes = [...select.matchAll(/<option value="([A-Z]{3})"/g)].map(
      (m) => m[1],
    );
    const unique = new Set(codes);
    expect(codes.length).toBe(unique.size);
    expect(codes).toContain("USD");
    expect(codes).toContain("EUR");
  });
});
