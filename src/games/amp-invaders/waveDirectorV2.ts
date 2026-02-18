import {
  type GenreId,
  type SpreadTier,
  type Stage3V2Config,
  getGenreForWave,
  getNextSpreadTier,
  resetSpreadTier
} from "./stage3v2Config";

export type WaveDirectorState = {
  wave: number;
  genre: GenreId;
  spreadTier: SpreadTier;
  nextUpgradeWave: number | null;
};

export type WaveDirectorV2 = {
  getState: () => WaveDirectorState;
  advanceOnWaveClear: () => WaveDirectorState;
  resetOnRetry: () => WaveDirectorState;
};

export function createWaveDirectorV2(config: Stage3V2Config): WaveDirectorV2 {
  let state: WaveDirectorState = {
    wave: 1,
    genre: getGenreForWave(config, 1),
    spreadTier: resetSpreadTier(config),
    nextUpgradeWave: 2
  };

  function computeNextUpgradeWave(tier: SpreadTier, currentWave: number): number | null {
    if (tier >= config.spread.maxTier) {
      return null;
    }
    return currentWave + 1;
  }

  return {
    getState() {
      return { ...state };
    },
    advanceOnWaveClear() {
      const nextWave = state.wave + 1;
      const nextTier = getNextSpreadTier(config, state.spreadTier);
      state = {
        wave: nextWave,
        genre: getGenreForWave(config, nextWave),
        spreadTier: nextTier,
        nextUpgradeWave: computeNextUpgradeWave(nextTier, nextWave)
      };
      return { ...state };
    },
    resetOnRetry() {
      const spreadTier = resetSpreadTier(config);
      state = {
        wave: 1,
        genre: getGenreForWave(config, 1),
        spreadTier,
        nextUpgradeWave: computeNextUpgradeWave(spreadTier, 1)
      };
      return { ...state };
    }
  };
}
