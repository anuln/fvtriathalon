export const TOTAL_TRI_MAX = 3600;

const STAGE_K = {
  "rhythm-serpent": 1600,
  "moshpit-pacman": 2500,
  "amp-invaders": 2800
} as const;

type StageId = keyof typeof STAGE_K;

export function toTriPoints(stage: StageId, rawScore: number): number {
  const k = STAGE_K[stage];
  return 1200 * (1 - Math.exp(-rawScore / k));
}
