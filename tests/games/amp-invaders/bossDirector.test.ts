import { describe, expect, it } from "vitest";
import { createBossDirector } from "../../../src/games/amp-invaders/bossDirector";
import { getBossPhaseSpec, STAGE3_V2_DEFAULT_CONFIG } from "../../../src/games/amp-invaders/stage3v2Config";

describe("bossDirector", () => {
  it("starts inactive and enters phase 1 when activated", () => {
    const boss = createBossDirector(STAGE3_V2_DEFAULT_CONFIG);
    expect(boss.getState().active).toBe(false);

    boss.enter();
    expect(boss.getState().active).toBe(true);
    expect(boss.getState().phase).toBe(1);
    expect(boss.getState().hp).toBe(STAGE3_V2_DEFAULT_CONFIG.boss.maxHp);
  });

  it("transitions phases at hp thresholds", () => {
    const boss = createBossDirector(STAGE3_V2_DEFAULT_CONFIG);
    boss.enter();

    boss.applyDamage(Math.ceil(STAGE3_V2_DEFAULT_CONFIG.boss.maxHp * 0.31));
    expect(boss.getState().phase).toBe(2);

    boss.applyDamage(Math.ceil(STAGE3_V2_DEFAULT_CONFIG.boss.maxHp * 0.36));
    expect(boss.getState().phase).toBe(3);
  });

  it("enforces telegraph before firing attacks", () => {
    const boss = createBossDirector(STAGE3_V2_DEFAULT_CONFIG);
    boss.enter();
    const phase1 = getBossPhaseSpec(STAGE3_V2_DEFAULT_CONFIG, 1);
    const preTelegraphMs = phase1.attackCooldownMs - phase1.telegraphMs - 10;

    let event = boss.update(preTelegraphMs);
    expect(event.attackFired).toBe(false);
    expect(boss.getState().telegraphActive).toBe(false);

    event = boss.update(20);
    expect(event.attackFired).toBe(false);
    expect(boss.getState().telegraphActive).toBe(true);

    event = boss.update(phase1.telegraphMs + 10);
    expect(event.attackFired).toBe(true);
    expect(event.pattern).toBe("sweep");
  });
});
