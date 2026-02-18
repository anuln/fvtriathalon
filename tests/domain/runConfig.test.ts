import { describe, expect, it } from "vitest";
import { resolveRunTotalMs } from "../../src/domain/runConfig";

describe("run config", () => {
  it("parses runMinutes from query string", () => {
    expect(resolveRunTotalMs("?runMinutes=6")).toBe(360_000);
    expect(resolveRunTotalMs("?runMinutes=7.5")).toBe(450_000);
  });

  it("falls back to default for invalid values", () => {
    expect(resolveRunTotalMs("?runMinutes=0")).toBe(540_000);
    expect(resolveRunTotalMs("?runMinutes=-2")).toBe(540_000);
    expect(resolveRunTotalMs("?runMinutes=abc")).toBe(540_000);
    expect(resolveRunTotalMs("")).toBe(540_000);
  });
});
