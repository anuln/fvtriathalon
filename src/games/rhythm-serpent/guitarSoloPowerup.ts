export type RhythmSerpentPowerKind = "bass-drop" | "encore" | "mosh-burst" | "guitar-solo";

export const GUITAR_SOLO_POWER_KIND: RhythmSerpentPowerKind = "guitar-solo";

export const RHYTHM_SERPENT_POWER_KINDS: RhythmSerpentPowerKind[] = [
  "bass-drop",
  "encore",
  "mosh-burst",
  GUITAR_SOLO_POWER_KIND
];

export const GUITAR_SOLO_PALETTE: Record<string, string> = {
  W: "#ffffff",
  G: "#73c45f",
  O: "#24053d",
  N: "#d4f1c9",
  A: "#f2d57a",
  B: "#9fd2ff",
  C: "#78bf5f",
  M: "#ff5a1f",
  R: "#2b003f",
  H: "#c58adf"
};

export const GUITAR_SOLO_SPRITE = [
  "........................",
  "....WWW.................",
  "...WGGGW................",
  "..WGOGGGW...............",
  "..WGOGGGW...............",
  "...WGGGW.......AAA......",
  "....WNNWW....AAABAA.....",
  ".....WNNNWW.AABBBBA.....",
  "......WNNNNWABBBBBBA....",
  ".......WNNNNWBBBBBBBA...",
  "........WNNNNWBBBBBBBA..",
  ".........WNNNNWBBBBBBBA.",
  "..........WNNNNWBBBBBBA.",
  "...........WNNNNWBBBBBA.",
  "............WNNNNWBBBBA.",
  "............WCCCCWBBBA..",
  "...........WCCCCCCWBA...",
  "..........WCCMCCCCCW....",
  ".........WCCCCCCCCCW....",
  "........WCCCCCCRRCCW....",
  ".......WCCCCCCCCCCHW....",
  ".......WCCCCCCCCCWW.....",
  "........WCCCCCCCWW......",
  ".........WWWWWWW........"
] as const;
