export type ScoreStageId = "rhythm-serpent" | "moshpit-pacman" | "amp-invaders";

export const TIME_BONUS_PER_SECOND = 2;
export const HIGH_SKILL_FULL_CLEAR_TIME_THRESHOLD_MS = 120_000;
export const HIGH_SKILL_FULL_CLEAR_BONUS = 1000;

export type FinalScoreOptions = {
  completedAllStages?: boolean;
  bossDefeated?: boolean;
};

export function computeStageScore(_stage: ScoreStageId, rawScore: number): number {
  return Math.max(0, Math.round(rawScore));
}

export function computeTimeLeftBonus(runMsLeft: number): number {
  const safeMs = Math.max(0, runMsLeft);
  return Math.floor(safeMs / 1000) * TIME_BONUS_PER_SECOND;
}

export function computeHighSkillBonus(runMsLeft: number, options?: FinalScoreOptions): number {
  const safeMs = Math.max(0, runMsLeft);
  const completedAllStages = options?.completedAllStages === true;
  const bossDefeated = options?.bossDefeated === true;
  if (!completedAllStages || !bossDefeated) {
    return 0;
  }
  if (safeMs <= HIGH_SKILL_FULL_CLEAR_TIME_THRESHOLD_MS) {
    return 0;
  }
  return HIGH_SKILL_FULL_CLEAR_BONUS;
}

export function computeFinalScore(stageScores: number[], runMsLeft: number, options?: FinalScoreOptions): {
  baseScore: number;
  timeBonus: number;
  highSkillBonus: number;
  totalScore: number;
} {
  const baseScore = stageScores.reduce((sum, score) => sum + Math.max(0, Math.round(score)), 0);
  const timeBonus = computeTimeLeftBonus(runMsLeft);
  const highSkillBonus = computeHighSkillBonus(runMsLeft, options);
  return {
    baseScore,
    timeBonus,
    highSkillBonus,
    totalScore: baseScore + timeBonus + highSkillBonus
  };
}
