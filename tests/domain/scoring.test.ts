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
    expect(result.highSkillBonus).toBe(0);
    expect(result.totalScore).toBe(940);
  });

  it("adds the headliner bonus only for full clear with boss defeated and more than two minutes remaining", () => {
    const result = computeFinalScore([520, 410, 680], 121_000, {
      completedAllStages: true,
      bossDefeated: true
    });
    expect(result.baseScore).toBe(1610);
    expect(result.timeBonus).toBe(242);
    expect(result.highSkillBonus).toBe(1000);
    expect(result.totalScore).toBe(2852);
  });

  it("does not apply the headliner bonus at exactly two minutes or without full completion", () => {
    const exactlyTwoMinutes = computeFinalScore([520, 410, 680], 120_000, {
      completedAllStages: true,
      bossDefeated: true
    });
    expect(exactlyTwoMinutes.highSkillBonus).toBe(0);

    const partialRun = computeFinalScore([520, 410, 680], 180_000, {
      completedAllStages: false
    });
    expect(partialRun.highSkillBonus).toBe(0);
  });

  it("does not apply the headliner bonus when boss is not defeated", () => {
    const noBossClear = computeFinalScore([520, 410, 680], 180_000, {
      completedAllStages: true,
      bossDefeated: false
    });
    expect(noBossClear.highSkillBonus).toBe(0);
  });
});
