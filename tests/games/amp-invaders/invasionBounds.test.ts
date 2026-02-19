import { describe, expect, it } from "vitest";
import { computeEnemyDropDelta, getEnemyInvasionFloorY } from "../../../src/games/amp-invaders/invasionBounds";

describe("invasion bounds", () => {
  it("keeps the enemy floor close to player lane without touching it", () => {
    expect(getEnemyInvasionFloorY(540)).toBe(392);
    expect(getEnemyInvasionFloorY(700)).toBe(552);
  });

  it("caps enemy descent at the invasion floor", () => {
    expect(computeEnemyDropDelta(340, 16, 392)).toBe(16);
    expect(computeEnemyDropDelta(388, 16, 392)).toBe(4);
    expect(computeEnemyDropDelta(392, 16, 392)).toBe(0);
    expect(computeEnemyDropDelta(420, 16, 392)).toBe(0);
  });

  it("never returns negative or non-finite drop deltas", () => {
    expect(computeEnemyDropDelta(388, -16, 392)).toBe(0);
    expect(computeEnemyDropDelta(Number.NaN, 16, 392)).toBe(0);
  });
});
