import { describe, expect, it } from "vitest";
import { getBossLaserColumns, planBossProjectiles, type BossProjectileKind } from "../../../src/games/amp-invaders/bossAttackPlanner";

describe("bossAttackPlanner", () => {
  it("includes player lane in vertical laser columns", () => {
    const cols = getBossLaserColumns({
      width: 960,
      bossX: 480,
      playerX: 740,
      phase: 2
    });
    expect(cols.some((x) => Math.abs(x - 740) <= 24)).toBe(true);
  });

  it("uses reduced seeker counts for phase 2 and phase 3 swarms", () => {
    const phase2Seekers = planBossProjectiles({
      pattern: "seekerSwarm",
      phase: 2,
      width: 960,
      height: 540,
      bossX: 480,
      bossY: 84,
      playerX: 410
    }).filter((item) => item.kind === "seeker");
    expect(phase2Seekers.length).toBe(2);

    const phase3Seekers = planBossProjectiles({
      pattern: "seekerSwarm",
      phase: 3,
      width: 960,
      height: 540,
      bossX: 480,
      bossY: 84,
      playerX: 410
    }).filter((item) => item.kind === "seeker");
    expect(phase3Seekers.length).toBe(3);
  });

  it("uses vertical laser projectiles for the laser attack", () => {
    const bullets = planBossProjectiles({
      pattern: "verticalLaser",
      phase: 2,
      width: 960,
      height: 540,
      bossX: 480,
      bossY: 84,
      playerX: 480
    });
    const kinds = new Set<BossProjectileKind>(bullets.map((item) => item.kind));
    expect(kinds.has("laser")).toBe(true);
  });
});
