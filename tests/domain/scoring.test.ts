import { describe, expect, it } from "vitest";
import { computeFinalScore, computeStageScore, computeTimeLeftBonus } from "../../src/domain/scoring";

describe("scoring", () => {
  it("uses additive stage scoring without normalization", () => {
    expect(computeStageScore("rhythm-serpent", 420)).toBe(420);
    expect(computeStageScore("moshpit-pacman", 420)).toBe(420);
    expect(computeStageScore("amp-invaders", 420)).toBe(420);
  });

  it("computes a bounded time-left bonus", () => {
    expect(computeTimeLeftBonus(120_000)).toBe(240);
    expect(computeTimeLeftBonus(1_000)).toBe(2);
    expect(computeTimeLeftBonus(0)).toBe(0);
    expect(computeTimeLeftBonus(-50)).toBe(0);
  });

  it("builds final score as additive stages plus time bonus", () => {
    const result = computeFinalScore([300, 220, 180], 120_000);
    expect(result.baseScore).toBe(700);
    expect(result.timeBonus).toBe(240);
    expect(result.totalScore).toBe(940);
  });
});
