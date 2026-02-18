export type GenreId = "pop" | "edm" | "hiphop" | "rock";
export type SpreadTier = 1 | 2 | 3 | 4;
export type SpecialKind = "diveBomber" | "shieldBreaker";

export type AggressionSpec = {
  baseFireCooldownMs: number;
  minFireCooldownMs: number;
  burstChance: number;
  burstCount: number;
  bulletSpeedScale: number;
};

export type SpecialSpawnSpec = {
  startWave: number;
  cooldownMs: number;
  telegraphMs: number;
  speed: number;
};

export type BossPhaseSpec = {
  phase: 1 | 2 | 3;
  hpThreshold: number;
  telegraphMs: number;
  attackCooldownMs: number;
  burstCount: number;
};

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
  aggressionByWave: ReadonlyArray<AggressionSpec>;
  specials: Record<SpecialKind, SpecialSpawnSpec>;
  boss: {
    entryWave: number;
    maxHp: number;
    phases: readonly BossPhaseSpec[];
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
  },
  aggressionByWave: [
    { baseFireCooldownMs: 900, minFireCooldownMs: 500, burstChance: 0.05, burstCount: 1, bulletSpeedScale: 1 },
    { baseFireCooldownMs: 760, minFireCooldownMs: 440, burstChance: 0.12, burstCount: 2, bulletSpeedScale: 1.1 },
    { baseFireCooldownMs: 640, minFireCooldownMs: 380, burstChance: 0.2, burstCount: 3, bulletSpeedScale: 1.18 },
    { baseFireCooldownMs: 520, minFireCooldownMs: 320, burstChance: 0.28, burstCount: 3, bulletSpeedScale: 1.26 }
  ],
  specials: {
    diveBomber: {
      startWave: 3,
      cooldownMs: 11_000,
      telegraphMs: 700,
      speed: 410
    },
    shieldBreaker: {
      startWave: 4,
      cooldownMs: 13_000,
      telegraphMs: 820,
      speed: 330
    }
  },
  boss: {
    entryWave: 4,
    maxHp: 220,
    phases: [
      { phase: 1, hpThreshold: 0.7, telegraphMs: 850, attackCooldownMs: 1500, burstCount: 2 },
      { phase: 2, hpThreshold: 0.35, telegraphMs: 720, attackCooldownMs: 1220, burstCount: 3 },
      { phase: 3, hpThreshold: 0, telegraphMs: 620, attackCooldownMs: 980, burstCount: 4 }
    ]
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

export function getAggressionSpec(config: Stage3V2Config, wave: number): AggressionSpec {
  const specs = config.aggressionByWave;
  const clampedWave = Math.max(1, Math.floor(wave));
  return specs[Math.min(specs.length - 1, clampedWave - 1)] ?? specs[0];
}

export function getSpecialSpawnSpec(config: Stage3V2Config, kind: SpecialKind): SpecialSpawnSpec {
  return config.specials[kind];
}

export function getBossPhaseSpec(config: Stage3V2Config, phase: 1 | 2 | 3): BossPhaseSpec {
  const item = config.boss.phases.find((spec) => spec.phase === phase);
  if (!item) {
    return config.boss.phases[config.boss.phases.length - 1] as BossPhaseSpec;
  }
  return item;
}
