import { describe, expect, it } from "vitest";
import { resolveEnemyBulletHit } from "../../../src/games/amp-invaders/collision";

describe("resolveEnemyBulletHit", () => {
  const width = 900;
  const height = 600;
  const base = {
    width,
    height,
    playerXNorm: 0.5,
    shields: [100, 100, 100] as [number, number, number]
  };

  it("does not register a player hit after shield collision", () => {
    const shieldX = width / 2;
    const shieldY = height - 150;
    const result = resolveEnemyBulletHit({
      ...base,
      bulletX: shieldX,
      bulletY: shieldY
    });

    expect(result.consumed).toBe(true);
    expect(result.playerHit).toBe(false);
    expect(result.shieldIndex).toBe(1);
    expect(result.shieldDamage).toBe(12);
  });

  it("does not hit the player when bullet is already below the booth", () => {
    const result = resolveEnemyBulletHit({
      ...base,
      bulletX: width * 0.5,
      bulletY: height + 24
    });

    expect(result.playerHit).toBe(false);
    expect(result.consumed).toBe(false);
    expect(result.shieldDamage).toBe(0);
  });

  it("hits the player when bullet overlaps booth hitbox", () => {
    const result = resolveEnemyBulletHit({
      ...base,
      bulletX: width * 0.5,
      bulletY: height - 70
    });

    expect(result.playerHit).toBe(true);
    expect(result.consumed).toBe(true);
    expect(result.shieldDamage).toBe(0);
  });
});
