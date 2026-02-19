import { describe, expect, it } from "vitest";
import { formatAmpLivesHearts } from "../../../src/games/amp-invaders/livesHud";

describe("amp invaders lives HUD", () => {
  it("shows one heart per remaining life up to max", () => {
    expect(formatAmpLivesHearts(3)).toBe("❤ ❤ ❤");
    expect(formatAmpLivesHearts(2)).toBe("❤ ❤");
    expect(formatAmpLivesHearts(1)).toBe("❤");
  });

  it("clamps to the valid range", () => {
    expect(formatAmpLivesHearts(0)).toBe("");
    expect(formatAmpLivesHearts(9)).toBe("❤ ❤ ❤");
    expect(formatAmpLivesHearts(-2)).toBe("");
  });
});
