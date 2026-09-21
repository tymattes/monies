import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

// Browser tests only (E2E=1, set by Playwright): fails on purpose so the error
// page can be checked in a real browser. In every other environment it is a 404.
export default function E2EErrorPage() {
  if (!process.env.E2E) notFound();
  throw new Error("deliberate failure for the error-page browser tests");
}
