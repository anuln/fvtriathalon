export const RHYTHM_SERPENT_UNLOCK_MS = 60_000;

export function shouldUnlockCommit(elapsedMs: number): boolean {
  return elapsedMs >= RHYTHM_SERPENT_UNLOCK_MS;
}
