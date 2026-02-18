import { describe, expect, it } from "vitest";
import {
  WAVE1_ENEMY_VARIANTS,
  WAVE2_ENEMY_VARIANTS,
  WAVE3_ENEMY_VARIANTS,
  getBulletSpriteKeysForWave,
  getWaveCycle,
  pickEnemyVariantForWave
} from "../../../src/games/amp-invaders/waveSpriteRoster";

describe("waveSpriteRoster", () => {
  it("maps waves into 4-wave cycle", () => {
    expect(getWaveCycle(1)).toBe(1);
    expect(getWaveCycle(2)).toBe(2);
    expect(getWaveCycle(3)).toBe(3);
    expect(getWaveCycle(4)).toBe(4);
    expect(getWaveCycle(5)).toBe(1);
    expect(getWaveCycle(8)).toBe(4);
  });

  it("cycles enemy variants for wave 1", () => {
    const picks = Array.from({ length: 8 }, (_, i) => pickEnemyVariantForWave(1, i));
    expect(picks).toEqual([
      WAVE1_ENEMY_VARIANTS[0],
      WAVE1_ENEMY_VARIANTS[1],
      WAVE1_ENEMY_VARIANTS[2],
      WAVE1_ENEMY_VARIANTS[3],
      WAVE1_ENEMY_VARIANTS[0],
      WAVE1_ENEMY_VARIANTS[1],
      WAVE1_ENEMY_VARIANTS[2],
      WAVE1_ENEMY_VARIANTS[3]
    ]);
  });

  it("cycles enemy variants for waves 2 and 3 and returns null for wave 4", () => {
    expect(pickEnemyVariantForWave(2, 0)).toBe(WAVE2_ENEMY_VARIANTS[0]);
    expect(pickEnemyVariantForWave(2, 4)).toBe(WAVE2_ENEMY_VARIANTS[1]);
    expect(pickEnemyVariantForWave(3, 0)).toBe(WAVE3_ENEMY_VARIANTS[0]);
    expect(pickEnemyVariantForWave(3, -1)).toBe(WAVE3_ENEMY_VARIANTS[2]);
    expect(pickEnemyVariantForWave(4, 0)).toBeNull();
  });

  it("always returns distinct player and enemy bullet keys", () => {
    for (const wave of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const keys = getBulletSpriteKeysForWave(wave);
      expect(keys.player).not.toBe(keys.enemy);
    }
  });
});
