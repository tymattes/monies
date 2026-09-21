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

// Dracula (dark) and Alucard (light) as computed by the browser.
export const DARK_BG = "rgb(40, 42, 54)";
export const LIGHT_BG = "rgb(255, 251, 235)";
export const DARK_ACCENT = "rgb(80, 250, 123)";
export const LIGHT_ACCENT = "rgb(20, 113, 10)";
export const LIGHT_DANGER = "rgb(203, 58, 42)";
