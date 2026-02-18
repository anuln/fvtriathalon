export const WAVE1_ENEMY_VARIANTS = ["w1_baseline", "w1_variant2", "w1_variant3", "w1_variant4"] as const;
export const WAVE2_ENEMY_VARIANTS = ["w2_variant1", "w2_variant2", "w2_variant3"] as const;
export const WAVE3_ENEMY_VARIANTS = ["w3_variant1", "w3_variant2", "w3_variant3"] as const;

export type EnemySpriteVariant =
  | (typeof WAVE1_ENEMY_VARIANTS)[number]
  | (typeof WAVE2_ENEMY_VARIANTS)[number]
  | (typeof WAVE3_ENEMY_VARIANTS)[number];

export type WaveCycle = 1 | 2 | 3 | 4;

export type BulletSpriteKey =
  | "w1_player"
  | "w1_enemy"
  | "w2_player"
  | "w2_enemy"
  | "w3_player"
  | "w3_enemy"
  | "w4_player"
  | "w4_enemy";

export function getWaveCycle(wave: number): WaveCycle {
  const normalized = Math.max(1, Math.floor(wave));
  const cycle = ((normalized - 1) % 4) + 1;
  return cycle as WaveCycle;
}

function pickByIndex<T>(items: readonly T[], slotIndex: number): T {
  const total = items.length;
  const normalized = ((Math.floor(slotIndex) % total) + total) % total;
  return items[normalized] as T;
}

export function pickEnemyVariantForWave(wave: number, slotIndex: number): EnemySpriteVariant | null {
  const cycle = getWaveCycle(wave);
  if (cycle === 1) {
    return pickByIndex(WAVE1_ENEMY_VARIANTS, slotIndex);
  }
  if (cycle === 2) {
    return pickByIndex(WAVE2_ENEMY_VARIANTS, slotIndex);
  }
  if (cycle === 3) {
    return pickByIndex(WAVE3_ENEMY_VARIANTS, slotIndex);
  }
  return null;
}

export function getBulletSpriteKeysForWave(wave: number): { player: BulletSpriteKey; enemy: BulletSpriteKey } {
  const cycle = getWaveCycle(wave);
  if (cycle === 1) {
    return { player: "w1_player", enemy: "w1_enemy" };
  }
  if (cycle === 2) {
    return { player: "w2_player", enemy: "w2_enemy" };
  }
  if (cycle === 3) {
    return { player: "w3_player", enemy: "w3_enemy" };
  }
  return { player: "w4_player", enemy: "w4_enemy" };
}
