"use client";

import { useEffect, useSyncExternalStore } from "react";

type Choice = "system" | "light" | "dark";

const KEY = "theme";
const QUERY = "(prefers-color-scheme: dark)";

// The choice lives in localStorage (per device). "system" means no saved value.
function readChoice(): Choice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function applyChoice(choice: Choice) {
  const dark =
    choice === "dark" ||
    (choice === "system" && window.matchMedia(QUERY).matches);
  document.documentElement.classList.toggle("dark", dark);
}

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange); // other tabs
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function setChoice(choice: Choice) {
  try {
    if (choice === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {}
  applyChoice(choice);
  listeners.forEach((l) => l());
}

const OPTIONS: { value: Choice; label: string; icon: React.ReactNode }[] = [
  {
    value: "system",
    label: "System theme",
    icon: (
      <>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </>
    ),
  },
  {
    value: "light",
    label: "Light theme",
    icon: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    ),
  },
  {
    value: "dark",
    label: "Dark theme",
    icon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  },
];

export default function ThemeToggle() {
  // Server render (and hydration) assume "system"; the real value is read
  // right after. The pre-paint script already set the correct class.
  const choice = useSyncExternalStore<Choice>(subscribe, readChoice, () => "system");

  // Re-apply the saved theme when the toggle mounts or changes. The pre-paint
  // script sets the class before first paint, but when React re-renders <html>
  // (for example after a page error) it resets the class, so this puts it back.
  useEffect(() => {
    applyChoice(choice);
  }, [choice]);

  // While following the system, react to OS theme changes.
  useEffect(() => {
    if (choice !== "system") return;
    const media = window.matchMedia(QUERY);
    const onChange = () => applyChoice("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [choice]);

  return (
    <div
      role="group"
      aria-label="Theme"
      className="inline-flex rounded-md border border-border-strong p-0.5"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-label={o.label}
          title={o.label}
          aria-pressed={choice === o.value}
          onClick={() => setChoice(o.value)}
          className={`rounded p-1.5 ${
            choice === o.value
              ? "bg-foreground text-background"
              : "text-muted hover:text-foreground"
          }`}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {o.icon}
          </svg>
        </button>
      ))}
    </div>
  );
}
