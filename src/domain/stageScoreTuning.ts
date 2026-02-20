export type AmpEnemyType = "basic" | "armored" | "elite";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function snakeComboMultiplier(combo: number): number {
  if (combo >= 8) return 2.2;
  if (combo >= 5) return 1.8;
  if (combo >= 3) return 1.35;
  return 1;
}

function snakeLengthMultiplier(length: number): number {
  const extraSegments = Math.max(0, Math.round(length) - 3);
  return 1 + Math.min(0.84, extraSegments * 0.05);
}

export function computeSnakeSustainBonus(length: number, combo: number): number {
  const extraSegments = Math.max(0, Math.round(length) - 3);
  const safeCombo = Math.max(0, Math.round(combo));
  const raw = 21 + extraSegments * 1.65 + safeCombo * 1.35;
  return Math.round(clamp(raw, 16, 84));
}

export function computeSnakeFoodScore(length: number, combo: number): number {
  const safeCombo = Math.max(1, Math.round(combo));
  const base = 22 + safeCombo * 1.6;
  const score = base * snakeComboMultiplier(safeCombo) * snakeLengthMultiplier(length);
  return Math.max(1, Math.round(score));
}

export function computeSnakeLengthMilestoneBonus(nextLengthMilestone: number): number {
  const safeMilestone = Math.max(0, Math.round(nextLengthMilestone));
  return Math.round(36 + safeMilestone * 6);
}

function ampWaveMultiplier(wave: number): number {
  const safeWave = Math.max(1, Math.floor(wave));
  if (safeWave >= 4) return 1.38;
  if (safeWave === 3) return 1.23;
  if (safeWave === 2) return 1.1;
  return 1;
}

export function computeAmpEnemyDefeatScore(enemyType: AmpEnemyType, wave: number): number {
  const base = enemyType === "elite" ? 42 : enemyType === "armored" ? 19 : 8;
  return Math.round(base * ampWaveMultiplier(wave));
}

export function computeAmpWaveClearBonus(clearedWave: number): number {
  const safeWave = Math.max(1, Math.floor(clearedWave));
  return 68 + safeWave * 14;
}

export function computeAmpBossEntryBonus(clearedWave: number): number {
  const safeWave = Math.max(1, Math.floor(clearedWave));
  return 198 + safeWave * 24;
}

export function computeAmpBossPhaseBreakBonus(newPhase: 2 | 3): number {
  return newPhase === 2 ? 150 : 225;
}

export function computeAmpBossDefeatBonus(): number {
  return 700;
}
