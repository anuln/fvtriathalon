export type BeatStageId = "rhythm-serpent" | "moshpit-pacman" | "amp-invaders";

const STAGE_BPM: Record<BeatStageId, number> = {
  "rhythm-serpent": 120,
  "moshpit-pacman": 126,
  "amp-invaders": 132
};

export function getStageBeatPulse(stage: BeatStageId, elapsedMs: number): number {
  const bpm = STAGE_BPM[stage];
  const beatMs = 60_000 / bpm;
  const phase = ((elapsedMs % beatMs) + beatMs) % beatMs / beatMs;
  return Math.pow(1 - phase, 4);
}
