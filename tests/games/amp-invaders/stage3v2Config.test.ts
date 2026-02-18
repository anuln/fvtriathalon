import { describe, expect, it } from "vitest";
import {
  STAGE3_V2_DEFAULT_CONFIG,
  getGenreForWave,
  getNextSpreadTier,
  getWaveSpec,
  resetSpreadTier
} from "../../../src/games/amp-invaders/stage3v2Config";

describe("stage3v2 config", () => {
  it("uses pop edm hiphop rock genre path in order", () => {
    expect(STAGE3_V2_DEFAULT_CONFIG.genrePath).toEqual(["pop", "edm", "hiphop", "rock"]);
  });

  it("maps genre by wave number deterministically", () => {
    expect(getGenreForWave(STAGE3_V2_DEFAULT_CONFIG, 1)).toBe("pop");
    expect(getGenreForWave(STAGE3_V2_DEFAULT_CONFIG, 2)).toBe("edm");
    expect(getGenreForWave(STAGE3_V2_DEFAULT_CONFIG, 3)).toBe("hiphop");
    expect(getGenreForWave(STAGE3_V2_DEFAULT_CONFIG, 4)).toBe("rock");
    expect(getGenreForWave(STAGE3_V2_DEFAULT_CONFIG, 5)).toBe("pop");
  });

  it("maps deterministic wave composition specs", () => {
    expect(getWaveSpec(STAGE3_V2_DEFAULT_CONFIG, 1)).toMatchObject({
      rows: 4,
      cols: 8,
      armoredRows: 2,
      eliteRows: 0
    });
    expect(getWaveSpec(STAGE3_V2_DEFAULT_CONFIG, 3)).toMatchObject({
      rows: 5,
      cols: 9,
      armoredRows: 2,
      eliteRows: 1
    });
    expect(getWaveSpec(STAGE3_V2_DEFAULT_CONFIG, 5)).toMatchObject({
      rows: 4,
      cols: 8,
      armoredRows: 2,
      eliteRows: 0
    });
  });

  it("increments spread tier on wave clear and caps at tier 4", () => {
    expect(getNextSpreadTier(STAGE3_V2_DEFAULT_CONFIG, 1)).toBe(2);
    expect(getNextSpreadTier(STAGE3_V2_DEFAULT_CONFIG, 2)).toBe(3);
    expect(getNextSpreadTier(STAGE3_V2_DEFAULT_CONFIG, 3)).toBe(4);
    expect(getNextSpreadTier(STAGE3_V2_DEFAULT_CONFIG, 4)).toBe(4);
  });

  it("resets spread tier to tier 1 on stage retry", () => {
    expect(resetSpreadTier(STAGE3_V2_DEFAULT_CONFIG)).toBe(1);
  });
});
