export const STAGE_ICONS = ["🐍", "👻", "🚀"] as const;
export const TOTAL_SCORE_ICON = "🏆" as const;

export function getStageIcon(index: number): string {
  const normalized = Math.max(0, Math.floor(index));
  return STAGE_ICONS[normalized] ?? STAGE_ICONS[STAGE_ICONS.length - 1] ?? "🚀";
}

export function getTotalScoreIcon(): string {
  return TOTAL_SCORE_ICON;
}
