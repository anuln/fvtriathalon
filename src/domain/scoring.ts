export type ScoreStageId = "rhythm-serpent" | "moshpit-pacman" | "amp-invaders";

export const TIME_BONUS_PER_SECOND = 2;

export function computeStageScore(_stage: ScoreStageId, rawScore: number): number {
  return Math.max(0, Math.round(rawScore));
}

export function computeTimeLeftBonus(runMsLeft: number): number {
  const safeMs = Math.max(0, runMsLeft);
  return Math.floor(safeMs / 1000) * TIME_BONUS_PER_SECOND;
}

export function computeFinalScore(stageScores: number[], runMsLeft: number): {
  baseScore: number;
  timeBonus: number;
  totalScore: number;
} {
  const baseScore = stageScores.reduce((sum, score) => sum + Math.max(0, Math.round(score)), 0);
  const timeBonus = computeTimeLeftBonus(runMsLeft);
  return {
    baseScore,
    timeBonus,
    totalScore: baseScore + timeBonus
  };
}
