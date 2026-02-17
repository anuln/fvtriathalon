export const TOTAL_TRI_MAX = 3600;

const STAGE_K = {
  "rhythm-serpent": 2400,
  "moshpit-pacman": 2100,
  "amp-invaders": 1900
} as const;

type StageId = keyof typeof STAGE_K;

export function toTriPoints(stage: StageId, rawScore: number): number {
  const k = STAGE_K[stage];
  return 1200 * (1 - Math.exp(-rawScore / k));
}
