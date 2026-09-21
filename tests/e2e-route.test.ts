import { afterEach, describe, expect, it, vi } from "vitest";
import E2EErrorPage from "@/app/e2e-error/page";

// /e2e-error exists only so browser tests can check the error page. Outside
// those tests (E2E unset) it must be an ordinary 404, never a deliberate crash.
describe("/e2e-error test route", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is a 404 when E2E is not set", () => {
    vi.stubEnv("E2E", "");
    let thrown: unknown;
    try {
      E2EErrorPage();
    } catch (e) {
      thrown = e;
    }
    expect(String((thrown as { digest?: string })?.digest)).toContain("404");
  });

  it("fails on purpose only when E2E is set", () => {
    vi.stubEnv("E2E", "1");
    expect(() => E2EErrorPage()).toThrow("deliberate failure");
  });
});
