export const WAVE1_ENEMY_VARIANTS = ["baseline", "variant2", "variant3", "variant4"] as const;

export type Wave1EnemyVariant = (typeof WAVE1_ENEMY_VARIANTS)[number];

export function pickWave1EnemyVariant(slotIndex: number): Wave1EnemyVariant {
  const total = WAVE1_ENEMY_VARIANTS.length;
  const normalized = ((Math.floor(slotIndex) % total) + total) % total;
  return WAVE1_ENEMY_VARIANTS[normalized] ?? "baseline";
}
