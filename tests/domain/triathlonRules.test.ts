import { describe, expect, it } from "vitest";
import { computeStageOptions } from "../../src/domain/triathlonRules";

describe("triathlon stage options", () => {
  it("unlocks commit at 60s or on early death", () => {
    expect(computeStageOptions({ elapsedMs: 59000, stageEnded: false }).canCommit).toBe(false);
    expect(computeStageOptions({ elapsedMs: 60000, stageEnded: false }).canCommit).toBe(true);
    expect(computeStageOptions({ elapsedMs: 12000, stageEnded: true }).canCommit).toBe(true);
  });
});
