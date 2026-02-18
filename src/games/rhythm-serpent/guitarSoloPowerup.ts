export type RhythmSerpentPowerKind = "bass-drop" | "encore" | "mosh-burst" | "guitar-solo";

export const GUITAR_SOLO_POWER_KIND: RhythmSerpentPowerKind = "guitar-solo";
export const GUITAR_SOLO_BONUS_MS = 5000;
export const GUITAR_SOLO_SCORE_MULTIPLIER = 2;

export const RHYTHM_SERPENT_POWER_KINDS: RhythmSerpentPowerKind[] = [
  "bass-drop",
  "encore",
  "mosh-burst",
  GUITAR_SOLO_POWER_KIND
];

export const GUITAR_SOLO_PALETTE: Record<string, string> = {
  W: "#f2f2f2"
};

export const GUITAR_SOLO_SPRITE = [
  "............WW..........",
  "...........WWWW.........",
  "...........WW.WW........",
  "..........WW...WW.......",
  "W........WWW....WW......",
  "WW.....WWWW......WW.....",
  "WWWWWWWWWWWWWWWWWWWW....",
  ".WWWWWWWWWWWWWWWWWWWW...",
  "...WWWWWWWWWWWWWWWWWWW..",
  ".....WWWWWWWWWWWWWWWW...",
  ".......WWWWWWWWWWWWWW...",
  "........WWWWWWWWWWW.....",
  ".........WWWWWWWWW......",
  "........WWWWWWWWWW......",
  ".......WWWWWWWWWWW......",
  "......WWWWWWWWWWW.......",
  ".....WWWWWWWWWWWW.......",
  "....WWWWWWWWWWWWW..W....",
  "...WWWWWWWWWWWWW...WW...",
  "..WWWWWWWWWWWW......WW..",
  "...WWWWWWWWW.........WW.",
  "....WWWWWWW...........WW",
  ".....WWWWW..............",
  "......WWW..............."
] as const;

export function applyGuitarSoloScoreMultiplier(scoreDelta: number, guitarSoloMs: number): number {
  const points = Math.max(0, Math.round(scoreDelta));
  if (guitarSoloMs > 0) {
    return points * GUITAR_SOLO_SCORE_MULTIPLIER;
  }
  return points;
}
