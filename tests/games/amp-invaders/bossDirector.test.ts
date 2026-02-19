import { describe, expect, it } from "vitest";
import { createBossDirector } from "../../../src/games/amp-invaders/bossDirector";
import { getBossPhaseSpec, STAGE3_V2_DEFAULT_CONFIG } from "../../../src/games/amp-invaders/stage3v2Config";

function fireNextAttack(
  boss: ReturnType<typeof createBossDirector>
) {
  const dt = Math.max(1, boss.getState().attackTimerMs + 1);
  return boss.update(dt);
}

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

  it("introduces vertical lasers and seekers in phase 2", () => {
    const boss = createBossDirector(STAGE3_V2_DEFAULT_CONFIG);
    boss.enter();
    boss.applyDamage(Math.ceil(STAGE3_V2_DEFAULT_CONFIG.boss.maxHp * 0.31));
    expect(boss.getState().phase).toBe(2);

    const first = fireNextAttack(boss);
    const second = fireNextAttack(boss);
    const third = fireNextAttack(boss);

    expect(first.pattern).toBe("volley");
    expect(second.pattern).toBe("verticalLaser");
    expect(third.pattern).toBe("seekerSwarm");
  });

  it("stacks hardest attacks in phase 3", () => {
    const boss = createBossDirector(STAGE3_V2_DEFAULT_CONFIG);
    boss.enter();
    boss.applyDamage(Math.ceil(STAGE3_V2_DEFAULT_CONFIG.boss.maxHp * 0.7));
    expect(boss.getState().phase).toBe(3);

    const first = fireNextAttack(boss);
    const second = fireNextAttack(boss);
    const third = fireNextAttack(boss);

    expect(first.pattern).toBe("verticalLaser");
    expect(second.pattern).toBe("enrageBurst");
    expect(third.pattern).toBe("seekerSwarm");
  });
});
