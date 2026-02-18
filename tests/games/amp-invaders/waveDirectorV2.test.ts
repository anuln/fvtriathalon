import { describe, expect, it } from "vitest";
import { STAGE3_V2_DEFAULT_CONFIG } from "../../../src/games/amp-invaders/stage3v2Config";
import { createWaveDirectorV2 } from "../../../src/games/amp-invaders/waveDirectorV2";

describe("waveDirectorV2", () => {
  it("starts on wave 1 pop with spread tier 1", () => {
    const director = createWaveDirectorV2(STAGE3_V2_DEFAULT_CONFIG);
    expect(director.getState()).toEqual({
      wave: 1,
      genre: "pop",
      spreadTier: 1,
      nextUpgradeWave: 2
    });
  });

  it("advances wave, follows genre path, and upgrades spread tier per wave clear", () => {
    const director = createWaveDirectorV2(STAGE3_V2_DEFAULT_CONFIG);
    expect(director.advanceOnWaveClear()).toEqual({
      wave: 2,
      genre: "edm",
      spreadTier: 2,
      nextUpgradeWave: 3
    });
    expect(director.advanceOnWaveClear()).toEqual({
      wave: 3,
      genre: "hiphop",
      spreadTier: 3,
      nextUpgradeWave: 4
    });
    expect(director.advanceOnWaveClear()).toEqual({
      wave: 4,
      genre: "rock",
      spreadTier: 4,
      nextUpgradeWave: null
    });
    expect(director.advanceOnWaveClear()).toEqual({
      wave: 5,
      genre: "pop",
      spreadTier: 4,
      nextUpgradeWave: null
    });
  });

  it("resets to tier 1 and wave 1 on retry", () => {
    const director = createWaveDirectorV2(STAGE3_V2_DEFAULT_CONFIG);
    director.advanceOnWaveClear();
    director.advanceOnWaveClear();

    expect(director.resetOnRetry()).toEqual({
      wave: 1,
      genre: "pop",
      spreadTier: 1,
      nextUpgradeWave: 2
    });
  });
});
