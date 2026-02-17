import { describe, expect, it } from "vitest";
import { nextGenreBlock } from "../../../src/games/amp-invaders/waveDirector";

describe("genre progression", () => {
  it("cycles through jazz rock edm metal", () => {
    expect(nextGenreBlock("jazz")).toBe("rock");
  });
});
