export const COMMIT_UNLOCK_MS = 60_000;

export type StageOptionsInput = {
  elapsedMs: number;
  stageEnded: boolean;
};

export type StageOptions = {
  canCommit: boolean;
  earlyDeathCommit: boolean;
  resetStageState: true;
};

export function computeStageOptions({ elapsedMs, stageEnded }: StageOptionsInput): StageOptions {
  const earlyDeathCommit = stageEnded && elapsedMs < COMMIT_UNLOCK_MS;

  return {
    canCommit: elapsedMs >= COMMIT_UNLOCK_MS || earlyDeathCommit,
    earlyDeathCommit,
    resetStageState: true
  };
}
