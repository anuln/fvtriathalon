import { describe, expect, it } from "vitest";
import { shouldEnterBossOnWaveClear } from "../../../src/games/amp-invaders/stageFlow";

describe("stageFlow", () => {
  it("treats wave 4 as boss entry when wave 3 is cleared", () => {
    expect(shouldEnterBossOnWaveClear(3, 4)).toBe(true);
  });

  it("does not enter boss before the pre-entry wave is cleared", () => {
    expect(shouldEnterBossOnWaveClear(1, 4)).toBe(false);
    expect(shouldEnterBossOnWaveClear(2, 4)).toBe(false);
  });

  it("returns true once already at or beyond boss entry wave", () => {
    expect(shouldEnterBossOnWaveClear(4, 4)).toBe(true);
    expect(shouldEnterBossOnWaveClear(5, 4)).toBe(true);
  });
});
