import { getStageIcon, getTotalScoreIcon } from "../domain/stageIcons";

const KILO = 1000;

export function sanitizeInitials(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3);
}

export function isValidInitials(value: string): boolean {
  return /^[A-Z]{3}$/.test(value);
}

export function formatCompactScore(value: number): string {
  const safe = Math.max(0, Math.round(value));
  if (safe < KILO) {
    return String(safe);
  }

  const asK = safe / KILO;
  if (asK < 10) {
    return `${asK.toFixed(1)}k`;
  }
  return `${Math.round(asK)}k`;
}

export function formatEmojiLine(input: {
  rank: number;
  initials: string;
  splits: [number, number, number] | number[];
  total: number;
}): string {
  const [stage1 = 0, stage2 = 0, stage3 = 0] = input.splits;
  return `#${input.rank} ${input.initials} ${getStageIcon(0)}${formatCompactScore(stage1)} ${getStageIcon(1)}${formatCompactScore(stage2)} ${getStageIcon(2)}${formatCompactScore(stage3)} ${getTotalScoreIcon()}${formatCompactScore(input.total)}`;
}
