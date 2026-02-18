export type GenreId = "pop" | "edm" | "hiphop" | "rock";
export type SpreadTier = 1 | 2 | 3 | 4;

export type Stage3V2Config = {
  genrePath: readonly GenreId[];
  wavePatterns: ReadonlyArray<{
    rows: number;
    cols: number;
    armoredRows: number;
    eliteRows: number;
    speedScale: number;
    fireCadenceScale: number;
  }>;
  spread: {
    initialTier: SpreadTier;
    maxTier: SpreadTier;
    progression: "wave-clear";
    retryResetToInitialTier: boolean;
  };
};

export const STAGE3_V2_DEFAULT_CONFIG: Stage3V2Config = {
  genrePath: ["pop", "edm", "hiphop", "rock"],
  wavePatterns: [
    { rows: 4, cols: 8, armoredRows: 2, eliteRows: 0, speedScale: 1, fireCadenceScale: 1 },
    { rows: 4, cols: 9, armoredRows: 2, eliteRows: 1, speedScale: 1.1, fireCadenceScale: 0.94 },
    { rows: 5, cols: 9, armoredRows: 2, eliteRows: 1, speedScale: 1.2, fireCadenceScale: 0.9 },
    { rows: 5, cols: 10, armoredRows: 3, eliteRows: 1, speedScale: 1.28, fireCadenceScale: 0.86 }
  ],
  spread: {
    initialTier: 1,
    maxTier: 4,
    progression: "wave-clear",
    retryResetToInitialTier: true
  }
};

export function getGenreForWave(config: Stage3V2Config, wave: number): GenreId {
  const index = ((Math.max(1, Math.floor(wave)) - 1) % config.genrePath.length) as number;
  return config.genrePath[index] ?? config.genrePath[0] ?? "pop";
}

export function getNextSpreadTier(config: Stage3V2Config, current: SpreadTier): SpreadTier {
  const next = (current + 1) as SpreadTier;
  return next > config.spread.maxTier ? config.spread.maxTier : next;
}

export function resetSpreadTier(config: Stage3V2Config): SpreadTier {
  if (!config.spread.retryResetToInitialTier) {
    return config.spread.maxTier;
  }
  return config.spread.initialTier;
}

export function getWaveSpec(
  config: Stage3V2Config,
  wave: number
): {
  rows: number;
  cols: number;
  armoredRows: number;
  eliteRows: number;
  speedScale: number;
  fireCadenceScale: number;
} {
  const patterns = config.wavePatterns;
  const index = ((Math.max(1, Math.floor(wave)) - 1) % patterns.length) as number;
  return patterns[index] ?? patterns[0];
}
