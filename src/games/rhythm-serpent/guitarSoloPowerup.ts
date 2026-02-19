export type RhythmSerpentPowerKind = "bass-drop" | "encore" | "mosh-burst" | "guitar-solo";
export type RhythmSerpentGraceTimers = {
  bassDropMs: number;
  encoreMs: number;
  moshBurstMs: number;
  guitarSoloMs: number;
};

export const GUITAR_SOLO_POWER_KIND: RhythmSerpentPowerKind = "guitar-solo";
export const GUITAR_SOLO_BONUS_MS = 5000;
export const GUITAR_SOLO_SCORE_MULTIPLIER = 2;

export const RHYTHM_SERPENT_POWER_KINDS: RhythmSerpentPowerKind[] = [
  "bass-drop",
  "encore",
  "mosh-burst",
  GUITAR_SOLO_POWER_KIND
];
const SOLO_SPAWN_ANCHORS_MS = [15_000, 45_000, 90_000] as const;
const SOLO_SPAWN_PROGRESSIVE_START_GAP_MS = 60_000;
const SOLO_SPAWN_PROGRESSIVE_GAP_STEP_MS = 15_000;

export const GUITAR_SOLO_PALETTE: Record<string, string> = {
  G: "#b8ea4f"
};

export const GUITAR_SOLO_SPRITE = [
  "..........GG............",
  ".........GGGG...........",
  "........GG..GG..........",
  ".......GG....GG.........",
  "GGGGGGGG......GG........",
  ".GGGG..........GG.......",
  "...GG............GG.....",
  "....GG.............GG...",
  ".....GG..............GG.",
  "......GG...............G",
  ".......GG............GG.",
  "........GG.........GG...",
  ".........GG......GG.....",
  "..........GG...GG.......",
  "...........GGGG.........",
  "..........GGGGG.........",
  ".........GG..GGG........",
  "........GG....GGG.......",
  ".......GG......GGG......",
  "......GG........GGG.....",
  ".....GG..........GG.....",
  "....GG............GG....",
  "...GG..............GG...",
  "..GG................GG.."
] as const;

export function applyGuitarSoloScoreMultiplier(scoreDelta: number, guitarSoloMs: number): number {
  const points = Math.max(0, Math.round(scoreDelta));
  if (guitarSoloMs > 0) {
    return points * GUITAR_SOLO_SCORE_MULTIPLIER;
  }
  return points;
}

export function getGuitarSoloSpawnAtMs(spawnIndex: number): number {
  const index = Math.max(0, Math.floor(spawnIndex));
  if (index < SOLO_SPAWN_ANCHORS_MS.length) {
    return SOLO_SPAWN_ANCHORS_MS[index] ?? SOLO_SPAWN_ANCHORS_MS[0];
  }
  let ms = SOLO_SPAWN_ANCHORS_MS[SOLO_SPAWN_ANCHORS_MS.length - 1] ?? 90_000;
  for (let i = SOLO_SPAWN_ANCHORS_MS.length; i <= index; i += 1) {
    const progressiveStep = i - SOLO_SPAWN_ANCHORS_MS.length;
    ms += SOLO_SPAWN_PROGRESSIVE_START_GAP_MS + progressiveStep * SOLO_SPAWN_PROGRESSIVE_GAP_STEP_MS;
  }
  return ms;
}

export function isRhythmGraceActive(openingGraceMs: number, timers: RhythmSerpentGraceTimers): boolean {
  return (
    openingGraceMs > 0 ||
    timers.bassDropMs > 0 ||
    timers.encoreMs > 0 ||
    timers.moshBurstMs > 0 ||
    timers.guitarSoloMs > 0
  );
}
