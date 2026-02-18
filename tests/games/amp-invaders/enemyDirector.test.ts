import { describe, expect, it } from "vitest";
import { createEnemyDirector } from "../../../src/games/amp-invaders/enemyDirector";
import { STAGE3_V2_DEFAULT_CONFIG } from "../../../src/games/amp-invaders/stage3v2Config";

describe("enemyDirector", () => {
  it("scales cooldown and shot pressure up by wave", () => {
    const director = createEnemyDirector(STAGE3_V2_DEFAULT_CONFIG);
    const wave1 = director.computeFirePlan({ wave: 1, elapsedMs: 12_000, aliveEnemies: 24 });
    const wave4 = director.computeFirePlan({ wave: 4, elapsedMs: 12_000, aliveEnemies: 24 });

    expect(wave1.cooldownMs).toBeGreaterThan(wave4.cooldownMs);
    expect(wave4.shots).toBeGreaterThanOrEqual(wave1.shots);
  });

  it("unlocks burst patterns in later waves", () => {
    const director = createEnemyDirector(STAGE3_V2_DEFAULT_CONFIG);
    const wave1 = director.computeFirePlan({ wave: 1, elapsedMs: 18_000, aliveEnemies: 18 });
    const wave3 = director.computeFirePlan({ wave: 3, elapsedMs: 18_000, aliveEnemies: 18 });

    expect(wave1.pattern).not.toBe("burst");
    expect(["dual", "burst"]).toContain(wave3.pattern);
  });

  it("is deterministic for identical input", () => {
    const director = createEnemyDirector(STAGE3_V2_DEFAULT_CONFIG);
    const a = director.computeFirePlan({ wave: 3, elapsedMs: 9700, aliveEnemies: 12 });
    const b = director.computeFirePlan({ wave: 3, elapsedMs: 9700, aliveEnemies: 12 });
    expect(a).toEqual(b);
  });
});
