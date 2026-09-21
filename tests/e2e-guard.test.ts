import { describe, expect, it } from "vitest";
import { assertScratch } from "../e2e/support/db.mts";

// The browser tests create, migrate and truncate a database, so this guard is
// what keeps them away from real data.
describe("browser-test scratch database guard", () => {
  it.each(["monies_e2e", "another_e2e", "x1_e2e"])("allows %s", (name) => {
    expect(() => assertScratch(name)).not.toThrow();
  });

  it.each(["monies", "postgres", "monies_test", "e2e", "monies_e2e_backup", "monies-e2e", "Monies_e2e", "", "monies_e2e; drop database monies"])(
    "refuses %j",
    (name) => {
      expect(() => assertScratch(name)).toThrow(/Refusing to run browser tests/);
    },
  );
});
