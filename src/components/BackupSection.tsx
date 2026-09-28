"use client";

import { useState } from "react";
import RestoreForm from "./RestoreForm";
import { cardCls, secondaryButtonCls } from "./ui";

// Owner-only, on the Household page (spec 044). The download needs no
// client JS — the browser's own handling of the anchor's `download`
// attribute covers it; only the destructive overwrite-restore is stateful.
export default function BackupSection({ householdName }: { householdName: string }) {
  const [showRestore, setShowRestore] = useState(false);

  return (
    <section className={`${cardCls} space-y-4 p-4`}>
      <div>
        <h2 className="font-medium">Backup</h2>
        <p className="text-sm text-muted">
          Download everything in this household — members, categories,
          budgets, bills, income, goals, and expenses — as a single JSON
          file. The file includes members&apos; password hashes, so treat it
          like a database backup, not something to share casually.
        </p>
      </div>
      <a href="/api/backup" download className={secondaryButtonCls}>
        Download backup
      </a>

      <div className="space-y-3 border-t border-border pt-4">
        {!showRestore ? (
          <button
            type="button"
            onClick={() => setShowRestore(true)}
            className="text-sm text-danger underline"
          >
            Restore from a backup file…
          </button>
        ) : (
          <>
            <p className="text-sm text-danger">
              Replaces every category, bill, goal, income source, and
              expense in this household, and every member&apos;s account,
              with what&apos;s in the file. This cannot be undone from inside
              the app.
            </p>
            <RestoreForm mode="overwrite" householdName={householdName} />
            <button
              type="button"
              onClick={() => setShowRestore(false)}
              className="text-sm text-muted underline"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </section>
  );
}
