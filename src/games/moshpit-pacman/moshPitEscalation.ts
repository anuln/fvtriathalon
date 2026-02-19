export type Stage2Pacing = {
  playerStepMs: number;
  guardStepMs: number;
};

function clamp(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getActiveMoshers(totalZoneCompletions: number, maxMoshers = 3): number {
  const safeMax = Math.max(1, maxMoshers);
  const completed = Math.max(0, Math.floor(totalZoneCompletions));
  if (completed >= 4) return Math.min(3, safeMax);
  if (completed >= 2) return Math.min(2, safeMax);
  return 1;
}

export function getStage2Pacing(level: number, totalZoneCompletions: number, frightMs: number): Stage2Pacing {
  const safeLevel = Math.max(1, Math.floor(level));
  const completed = Math.max(0, Math.floor(totalZoneCompletions));
  const activeMoshers = getActiveMoshers(completed);

  const playerBase = 160;
  const playerStepMs = clamp(
    88,
    playerBase - completed * 5 - (safeLevel - 1) * 2,
    playerBase
  );

  const guardBase = 232;
  const frightPenalty = frightMs > 0 ? 24 : 0;
  const guardStepMs = clamp(
    100,
    guardBase - completed * 12 - (safeLevel - 1) * 4 - (activeMoshers - 1) * 12 + frightPenalty,
    guardBase
  );

  return {
    playerStepMs,
    guardStepMs
  };
}
