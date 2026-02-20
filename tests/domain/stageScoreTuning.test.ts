import { describe, expect, it } from "vitest";
import {
  computeAmpBossDefeatBonus,
  computeAmpBossEntryBonus,
  computeAmpBossPhaseBreakBonus,
  computeAmpEnemyDefeatScore,
  computeAmpWaveClearBonus,
  computeSnakeFoodScore,
  computeSnakeLengthMilestoneBonus,
  computeSnakeSustainBonus
} from "../../src/domain/stageScoreTuning";

describe("stage score tuning", () => {
  it("keeps rhythm serpent sustain bonus progressive but capped", () => {
    expect(computeSnakeSustainBonus(6, 1)).toBe(27);
    expect(computeSnakeSustainBonus(18, 5)).toBe(53);
    expect(computeSnakeSustainBonus(40, 12)).toBe(84);
  });

  it("reduces rhythm serpent late-game runaway via softer scaling", () => {
    const mid = computeSnakeFoodScore(10, 5);
    const late = computeSnakeFoodScore(34, 8);
    expect(mid).toBe(73);
    expect(late).toBe(141);
    expect(late / mid).toBeLessThan(2);
  });

  it("awards smaller rhythm serpent length milestones than prior curve", () => {
    expect(computeSnakeLengthMilestoneBonus(6)).toBe(72);
    expect(computeSnakeLengthMilestoneBonus(18)).toBe(144);
    expect(computeSnakeLengthMilestoneBonus(30)).toBe(216);
  });

  it("scales amp invaders enemy rewards by wave depth", () => {
    expect(computeAmpEnemyDefeatScore("basic", 1)).toBe(8);
    expect(computeAmpEnemyDefeatScore("basic", 3)).toBe(10);
    expect(computeAmpEnemyDefeatScore("armored", 4)).toBe(26);
    expect(computeAmpEnemyDefeatScore("elite", 4)).toBe(58);
  });

  it("boosts wave, boss-entry, and boss-phase rewards for deep stage 3 play", () => {
    expect(computeAmpWaveClearBonus(1)).toBe(82);
    expect(computeAmpWaveClearBonus(3)).toBe(110);
    expect(computeAmpBossEntryBonus(3)).toBe(270);
    expect(computeAmpBossPhaseBreakBonus(2)).toBe(150);
    expect(computeAmpBossPhaseBreakBonus(3)).toBe(225);
    expect(computeAmpBossDefeatBonus()).toBe(700);
  });
});
