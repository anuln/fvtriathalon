import { describe, expect, it } from "vitest";
import { getActiveMoshers, getStage2Pacing } from "../../../src/games/moshpit-pacman/moshPitEscalation";

describe("getActiveMoshers", () => {
  it("releases mosh-pit characters progressively by completed zones", () => {
    expect(getActiveMoshers(0)).toBe(1);
    expect(getActiveMoshers(1)).toBe(1);
    expect(getActiveMoshers(2)).toBe(2);
    expect(getActiveMoshers(3)).toBe(2);
    expect(getActiveMoshers(4)).toBe(3);
    expect(getActiveMoshers(9)).toBe(3);
  });
});

describe("getStage2Pacing", () => {
  it("starts slower and accelerates as zone completions increase", () => {
    const start = getStage2Pacing(1, 0, 0);
    const mid = getStage2Pacing(1, 2, 0);
    const late = getStage2Pacing(1, 4, 0);

    expect(start.playerStepMs).toBe(160);
    expect(start.guardStepMs).toBe(232);
    expect(mid.playerStepMs).toBeLessThan(start.playerStepMs);
    expect(mid.guardStepMs).toBeLessThan(start.guardStepMs);
    expect(late.playerStepMs).toBeLessThan(mid.playerStepMs);
    expect(late.guardStepMs).toBeLessThan(mid.guardStepMs);
  });

  it("keeps accelerating with level and temporarily slows guards in fright mode", () => {
    const lateLevel = getStage2Pacing(5, 4, 0);
    const lateFright = getStage2Pacing(5, 4, 3000);

    expect(lateLevel.playerStepMs).toBe(132);
    expect(lateLevel.guardStepMs).toBe(144);
    expect(lateFright.guardStepMs).toBeGreaterThan(lateLevel.guardStepMs);
  });
});
