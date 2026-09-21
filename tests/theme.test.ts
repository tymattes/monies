import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const css = readFileSync(path.join(root, "src/app/globals.css"), "utf8");

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

  // --danger is deliberately not checked on --surface: Dracula red on the
  // lighter surface is below 4.5:1, so error text must not sit on surfaces.
  it.each(["foreground", "muted", "accent"])(
    "%s text meets WCAG AA (4.5:1) on the surface",
    (token) => {
      expect(contrast(t[token], t.surface)).toBeGreaterThanOrEqual(4.5);
    },
  );
});

describe("dark theme", () => {
  it("uses the Dracula palette", () => {
    const d = themes.dark;
    expect(d.background.toLowerCase()).toBe("#282a36");
    expect(d.foreground.toLowerCase()).toBe("#f8f8f2");
    expect(d.surface.toLowerCase()).toBe("#44475a");
    expect(d.danger.toLowerCase()).toBe("#ff5555");
    expect(d.accent.toLowerCase()).toBe("#50fa7b");
  });

  it("keeps input borders visible against the background (3:1)", () => {
    expect(contrast(themes.dark["border-strong"], themes.dark.background)).toBeGreaterThanOrEqual(3);
  });
});

describe("theme setup", () => {
  it("defines the same tokens for both themes", () => {
    expect(Object.keys(themes.dark).sort()).toEqual(Object.keys(themes.light).sort());
  });

  it("maps every token into the Tailwind theme", () => {
    for (const token of Object.keys(themes.light)) {
      expect(css).toContain(`--color-${token}: var(--${token})`);
    }
  });

  it("sets color-scheme for native controls in both themes", () => {
    expect(css).toMatch(/:root\s*\{[^}]*color-scheme:\s*light/);
    expect(css).toMatch(/:root\.dark\s*\{[^}]*color-scheme:\s*dark/);
  });

  it("makes the dark: variant follow the dark class", () => {
    expect(css).toMatch(/@custom-variant dark/);
  });
});

// Guards against reintroducing colors that bypass the tokens.
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(tsx?|jsx?)$/.test(name) ? [full] : [];
  });
}

describe("no hardcoded colors in components", () => {
  const files = sourceFiles(path.join(root, "src")).map((f) => ({
    name: path.relative(root, f),
    text: readFileSync(f, "utf8"),
  }));

  it("does not use translucent foreground overlays (use --surface / --border / --muted)", () => {
    const bad = files.filter((f) => /(?:border|divide|bg|text|ring|outline)-foreground\/\d+/.test(f.text));
    expect(bad.map((f) => f.name)).toEqual([]);
  });

  it("does not use Tailwind palette colors or literal hex colors", () => {
    const palette = /\b(?:text|bg|border|divide|ring|fill|stroke)-(?:white|black|red|green|emerald|blue|gray|slate|zinc|neutral|stone|yellow|orange|amber|purple|pink|cyan|teal|indigo)(?:-\d{2,3})?\b/;
    const hex = /["'`]#[0-9a-fA-F]{3,8}["'`]/;
    const bad = files.filter((f) => palette.test(f.text) || hex.test(f.text));
    expect(bad.map((f) => f.name)).toEqual([]);
  });
});
