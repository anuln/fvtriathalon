import type { SpreadTier } from "./stage3v2Config";

export type PlayerShot = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  enemy: false;
};

const TIER_VX: Record<SpreadTier, ReadonlyArray<number>> = {
  1: [0],
  2: [-150, 150],
  3: [-170, 0, 170],
  4: [-220, -80, 80, 220]
};

export function buildPlayerVolley(tier: SpreadTier, originX: number, originY: number): PlayerShot[] {
  const vx = TIER_VX[tier] ?? TIER_VX[1];
  return vx.map((shotVx) => ({
    x: originX,
    y: originY,
    vx: shotVx,
    vy: -620,
    damage: 1,
    enemy: false as const
  }));
}
