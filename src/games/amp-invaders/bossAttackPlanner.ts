import type { BossAttackPattern } from "./bossDirector";

export type BossProjectileKind = "standard" | "laser" | "seeker";

export type BossProjectileSpec = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  kind: BossProjectileKind;
};

export type BossAttackPlanInput = {
  pattern: BossAttackPattern;
  phase: 1 | 2 | 3;
  width: number;
  height: number;
  bossX: number;
  bossY: number;
  playerX: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function uniqByDistance(items: number[], minSpacing: number): number[] {
  const sorted = [...items].sort((a, b) => a - b);
  const out: number[] = [];
  for (const item of sorted) {
    if (!out.some((existing) => Math.abs(existing - item) < minSpacing)) {
      out.push(item);
    }
  }
  return out;
}

export function getBossLaserColumns(input: {
  width: number;
  bossX: number;
  playerX: number;
  phase: 1 | 2 | 3;
}): number[] {
  const width = Math.max(160, Math.floor(input.width));
  const bossX = clamp(input.bossX, 24, width - 24);
  const playerX = clamp(input.playerX, 24, width - 24);
  const offsets = input.phase === 3 ? [-180, -95, 0, 95, 180] : [-130, 0, 130];
  const columns = offsets.map((offset) => clamp(bossX + offset, 24, width - 24));
  columns.push(playerX);
  return uniqByDistance(columns, 28);
}

export function planBossProjectiles(input: BossAttackPlanInput): BossProjectileSpec[] {
  const width = Math.max(160, Math.floor(input.width));
  const bossX = clamp(input.bossX, 24, width - 24);
  const playerX = clamp(input.playerX, 24, width - 24);
  const phase = input.phase;
  const y = input.bossY + 28;

  if (input.pattern === "sweep") {
    const vxList = phase === 1 ? [-180, -90, 0, 90, 180] : [-220, -120, 0, 120, 220];
    return vxList.map((vx) => ({
      x: bossX,
      y,
      vx,
      vy: 320 + Math.abs(vx) * 0.2,
      damage: 1,
      kind: "standard"
    }));
  }

  if (input.pattern === "volley") {
    const aimDx = playerX - bossX;
    const clampedAim = clamp(aimDx * 0.68, -170, 170);
    const spread = phase >= 3 ? 110 : 90;
    return [clampedAim - spread, clampedAim, clampedAim + spread].map((vx) => ({
      x: bossX,
      y,
      vx,
      vy: 350,
      damage: 1,
      kind: "standard"
    }));
  }

  if (input.pattern === "enrageBurst") {
    const vxList = phase >= 3 ? [-300, -220, -150, -80, 0, 80, 150, 220, 300] : [-260, -170, -90, 0, 90, 170, 260];
    return vxList.map((vx) => ({
      x: bossX,
      y,
      vx,
      vy: 370 + Math.abs(vx) * 0.16,
      damage: 1,
      kind: "standard"
    }));
  }

  if (input.pattern === "verticalLaser") {
    return getBossLaserColumns({
      width: input.width,
      bossX,
      playerX,
      phase
    }).map((column) => ({
      x: column,
      y: Math.max(18, input.bossY - 8),
      vx: 0,
      vy: phase >= 3 ? 560 : 500,
      damage: 1,
      kind: "laser"
    }));
  }

  // seekerSwarm
  const offsets = phase >= 3 ? [-96, -36, 36, 96] : [-64, 0, 64];
  return offsets.map((offset) => ({
    x: clamp(bossX + offset, 24, width - 24),
    y,
    vx: offset * 0.85,
    vy: phase >= 3 ? 250 : 220,
    damage: 1,
    kind: "seeker"
  }));
}
