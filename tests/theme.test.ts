import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  path.join(process.cwd(), "src/app/globals.css"),
  "utf8",
);

function tokens(selector: string): Record<string, string> {
  const block = new RegExp(`${selector.replace(/[.:]/g, "\\$&")}\\s*\\{([^}]*)\\}`).exec(css);
  if (!block) throw new Error(`no ${selector} block in globals.css`);
  return Object.fromEntries(
    [...block[1].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]),
  );
}

// WCAG 2.x relative luminance and contrast ratio.
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const themes = { light: tokens(":root"), dark: tokens(":root.dark") };

describe.each(Object.entries(themes))("%s theme tokens", (_name, t) => {
  it.each(["foreground", "muted", "danger", "accent"])(
    "%s text meets WCAG AA (4.5:1) on the background",
    (token) => {
      expect(contrast(t[token], t.background)).toBeGreaterThanOrEqual(4.5);
    },
  );
});

describe("theme setup", () => {
  it("defines the same tokens for both themes", () => {
    expect(Object.keys(themes.dark).sort()).toEqual(Object.keys(themes.light).sort());
  });

  it("sets color-scheme for native controls in both themes", () => {
    expect(css).toMatch(/:root\s*\{[^}]*color-scheme:\s*light/);
    expect(css).toMatch(/:root\.dark\s*\{[^}]*color-scheme:\s*dark/);
  });

  it("makes the dark: variant follow the dark class", () => {
    expect(css).toMatch(/@custom-variant dark/);
  });
});
