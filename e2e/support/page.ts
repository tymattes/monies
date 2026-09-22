import type { Page } from "@playwright/test";
import { E2E_ORIGIN } from "./db.mts";

type Person = { email: string; password: string };

// Signs in through the API on the page's own browser context, so the next
// navigation is already authenticated (no sign-in form needed).
export async function signIn(page: Page, who: Person) {
  const res = await page.request.post("/api/auth/sign-in/email", {
    data: { email: who.email, password: who.password },
    headers: { origin: E2E_ORIGIN },
  });
  if (!res.ok()) throw new Error(`Sign-in failed: ${res.status()} ${await res.text()}`);
}

// Waits until React has hydrated the header's theme control, so clicks and
// typing are not lost to a page that is still just server-rendered HTML.
export async function waitHydrated(page: Page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('[aria-label="Theme"] button');
    return !!el && Object.keys(el).some((k) => k.startsWith("__reactProps"));
  });
}

export const isDark = (page: Page) =>
  page.evaluate(() => document.documentElement.classList.contains("dark"));

export const bodyBackground = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

// The main pages, for the layout, accessibility and screenshot checks.
export const SIGNED_IN_PAGES = [
  { name: "overview", path: "/" },
  { name: "budget", path: "/budget" },
  { name: "bills", path: "/bills" },
  { name: "income", path: "/income" },
  { name: "members", path: "/members" },
];
export const SIGNED_OUT_PAGES = [{ name: "sign-in", path: "/sign-in" }];

// Dracula (dark) and Alucard (light) as computed by the browser. The page is the
// canvas behind everything; cards (panels, lists, tables) are raised above it.
export const DARK_PAGE = "rgb(33, 34, 44)";
export const LIGHT_PAGE = "rgb(242, 239, 228)";
export const DARK_CARD = "rgb(40, 42, 54)";
export const LIGHT_CARD = "rgb(255, 251, 235)";
export const DARK_SUBTLE = "rgb(52, 55, 70)";
export const LIGHT_SUBTLE = "rgb(247, 244, 232)";
export const DARK_ACCENT = "rgb(80, 250, 123)";
export const LIGHT_ACCENT = "rgb(20, 113, 10)";
export const LIGHT_DANGER = "rgb(200, 55, 31)";

// "$1,234.50" or "-$70.00" -> cents.
export function cents(text: string): number {
  const m = text.match(/(-)?\$([\d,]+)\.(\d{2})/);
  if (!m) throw new Error(`No amount in "${text}"`);
  const value = Number(m[2].replace(/,/g, "")) * 100 + Number(m[3]);
  return m[1] ? -value : value;
}

export const money = (c: number) => `${c < 0 ? "-" : ""}$${(Math.abs(c) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
