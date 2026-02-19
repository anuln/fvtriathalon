import { describe, expect, it } from "vitest";
import { getStageIcon, getTotalScoreIcon, STAGE_ICONS, TOTAL_SCORE_ICON } from "../../src/domain/stageIcons";

describe("stageIcons", () => {
  it("exposes the stage icon order for triathlon screens", () => {
    expect(STAGE_ICONS).toEqual(["🐍", "👻", "🚀"]);
    expect(TOTAL_SCORE_ICON).toBe("🏆");
  });

  it("returns an icon by stage index with safe fallback", () => {
    expect(getStageIcon(0)).toBe("🐍");
    expect(getStageIcon(1)).toBe("👻");
    expect(getStageIcon(2)).toBe("🚀");
    expect(getStageIcon(99)).toBe("🚀");
    expect(getTotalScoreIcon()).toBe("🏆");
  });
});
