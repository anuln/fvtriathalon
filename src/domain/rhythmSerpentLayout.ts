export type RhythmSerpentGrid = {
  cols: number;
  rows: number;
};

const DESKTOP_GRID: RhythmSerpentGrid = { cols: 24, rows: 16 };
const PORTRAIT_TALL_GRID: RhythmSerpentGrid = { cols: 14, rows: 26 };
const PORTRAIT_MEDIUM_GRID: RhythmSerpentGrid = { cols: 16, rows: 24 };

export function computeRhythmSerpentGrid(width: number, height: number): RhythmSerpentGrid {
  const safeWidth = Math.max(1, Math.floor(width));
  const safeHeight = Math.max(1, Math.floor(height));
  const ratio = safeHeight / safeWidth;

  if (ratio >= 1.85) {
    return PORTRAIT_TALL_GRID;
  }
  if (ratio >= 1.35) {
    return PORTRAIT_MEDIUM_GRID;
  }
  return DESKTOP_GRID;
}
