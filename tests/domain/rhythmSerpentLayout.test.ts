import { describe, expect, it } from "vitest";
import { computeRhythmSerpentGrid } from "../../src/domain/rhythmSerpentLayout";

function computeHeightCoverage(width: number, height: number, cols: number, rows: number): number {
  const cell = Math.floor(Math.min(width / cols, height / rows));
  return (cell * rows) / height;
}

describe("rhythm serpent layout", () => {
  it("uses a portrait-optimized grid on tall mobile screens", () => {
    const grid = computeRhythmSerpentGrid(390, 844);
    expect(grid).toEqual({ cols: 14, rows: 26 });

    const coverage = computeHeightCoverage(390, 844, grid.cols, grid.rows);
    expect(coverage).toBeGreaterThan(0.8);
  });

  it("keeps classic desktop grid on landscape screens", () => {
    const grid = computeRhythmSerpentGrid(1366, 768);
    expect(grid).toEqual({ cols: 24, rows: 16 });
  });
});
