import { describe, expect, it } from "vitest";
import {
  STAGE3_V2_DEFAULT_CONFIG,
  getAggressionSpec,
  getBossPhaseSpec,
  getSpecialSpawnSpec
} from "../../../src/games/amp-invaders/stage3v2Config";

describe("stage3v2 balance config", () => {
  it("keeps spread progression strictly wave-clear", () => {
    expect(STAGE3_V2_DEFAULT_CONFIG.spread.progression).toBe("wave-clear");
  });

  it("defines escalating aggression specs for waves 1-4", () => {
    const w1 = getAggressionSpec(STAGE3_V2_DEFAULT_CONFIG, 1);
    const w2 = getAggressionSpec(STAGE3_V2_DEFAULT_CONFIG, 2);
    const w3 = getAggressionSpec(STAGE3_V2_DEFAULT_CONFIG, 3);
    const w4 = getAggressionSpec(STAGE3_V2_DEFAULT_CONFIG, 4);

    expect(w1.baseFireCooldownMs).toBeGreaterThan(w2.baseFireCooldownMs);
    expect(w2.baseFireCooldownMs).toBeGreaterThan(w3.baseFireCooldownMs);
    expect(w3.baseFireCooldownMs).toBeGreaterThan(w4.baseFireCooldownMs);
    expect(w4.burstCount).toBeGreaterThanOrEqual(w3.burstCount);
  });

  it("defines fly-down special spawn rules", () => {
    const dive = getSpecialSpawnSpec(STAGE3_V2_DEFAULT_CONFIG, "diveBomber");
    const shield = getSpecialSpawnSpec(STAGE3_V2_DEFAULT_CONFIG, "shieldBreaker");

    expect(dive.startWave).toBe(3);
    expect(dive.telegraphMs).toBeGreaterThanOrEqual(500);
    expect(shield.startWave).toBe(4);
    expect(shield.cooldownMs).toBeGreaterThan(0);
  });

  it("defines a 3-phase boss config", () => {
    expect(STAGE3_V2_DEFAULT_CONFIG.boss.maxHp).toBeGreaterThan(0);
    expect(STAGE3_V2_DEFAULT_CONFIG.boss.entryWave).toBe(4);

    const phase1 = getBossPhaseSpec(STAGE3_V2_DEFAULT_CONFIG, 1);
    const phase2 = getBossPhaseSpec(STAGE3_V2_DEFAULT_CONFIG, 2);
    const phase3 = getBossPhaseSpec(STAGE3_V2_DEFAULT_CONFIG, 3);

    expect(phase1.hpThreshold).toBe(0.7);
    expect(phase2.hpThreshold).toBe(0.35);
    expect(phase3.telegraphMs).toBeLessThanOrEqual(phase2.telegraphMs);
  });
});
