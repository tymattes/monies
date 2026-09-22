"use client";

import { themeScript } from "@/lib/themeScript";
import "./globals.css";

// The last-resort error page, used when even the root layout fails. It has to
// supply its own <html> and <body>, so it loads the theme styles and the same
// pre-paint theme script the layout uses (saved choice, else the OS setting).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-screen items-center justify-center px-4">
        <div
          role="alert"
          className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-sm sm:p-8"
        >
          <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted">
            Monies couldn&apos;t load this page. Try again, or reload.
          </p>
          {error.digest && (
            <p className="mt-4 text-xs text-muted">
              Error reference: <code className="font-mono">{error.digest}</code>
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md border border-border-strong px-3 py-1.5 text-sm hover:bg-surface"
            >
              Reload page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
