import { describe, expect, it } from "vitest";
import { WAVE1_ENEMY_VARIANTS, pickWave1EnemyVariant } from "../../../src/games/amp-invaders/wave1SpriteRoster";

describe("wave1SpriteRoster", () => {
  it("exposes four wave-1 enemy variants", () => {
    expect(WAVE1_ENEMY_VARIANTS).toEqual(["baseline", "variant2", "variant3", "variant4"]);
  });

  it("cycles deterministically across formation slots", () => {
    const picks = Array.from({ length: 8 }, (_, i) => pickWave1EnemyVariant(i));
    expect(picks).toEqual([
      "baseline",
      "variant2",
      "variant3",
      "variant4",
      "baseline",
      "variant2",
      "variant3",
      "variant4"
    ]);
  });

  it("normalizes negative slot indices", () => {
    expect(pickWave1EnemyVariant(-1)).toBe("variant4");
    expect(pickWave1EnemyVariant(-2)).toBe("variant3");
  });
});
