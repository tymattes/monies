"use client";

import { useEffect } from "react";
import { buttonCls, cardCls, secondaryButtonCls } from "@/components/ui";

// Shown when a page fails to render. It replaces Next's plain default error
// page with one in the app's own look, and surfaces the error's digest so a
// failure can be matched to the server logs.
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12 sm:py-20">
      <div role="alert" className={`${cardCls} p-6 sm:p-8`}>
        <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted">
          This page couldn&apos;t load. Trying again usually fixes it. If it keeps
          happening, the details below help find the cause.
        </p>
        {error.digest && (
          <p className="mt-4 text-xs text-muted">
            Error reference: <code className="font-mono">{error.digest}</code>
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" onClick={() => reset()} className={buttonCls}>
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={secondaryButtonCls}
          >
            Reload page
          </button>
        </div>
      </div>
    </main>
  );
}
