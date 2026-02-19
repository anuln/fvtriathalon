import { describe, expect, it } from "vitest";
import { formatMoshPitLifeHeart } from "../../../src/games/moshpit-pacman/lifeHud";

describe("formatMoshPitLifeHeart", () => {
  it("shows a single heart while the crowd-save life is available", () => {
    expect(formatMoshPitLifeHeart(1)).toBe("❤");
    expect(formatMoshPitLifeHeart(2)).toBe("❤");
  });

  it("removes the heart when the life is exhausted", () => {
    expect(formatMoshPitLifeHeart(0)).toBe("");
    expect(formatMoshPitLifeHeart(-1)).toBe("");
  });
});
