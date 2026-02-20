export const ZONE_LEVEL_STEP = 6;

const ZONE_REPEAT_DECAY = [1, 0.72, 0.56, 0.45] as const;

export function zonesReadyForRespawn(zoneCollected: number[], zoneTotals: number[]): number[] {
  const ready: number[] = [];
  for (let i = 0; i < zoneTotals.length; i += 1) {
    const total = Math.max(0, zoneTotals[i] ?? 0);
    if (total <= 0) continue;
    const collected = Math.max(0, zoneCollected[i] ?? 0);
    if (collected >= total) {
      ready.push(i);
    }
  }
  return ready;
}

export function computeZoneCompletionBonus(zoneTileCount: number, completionCount: number): number {
  const totalTiles = Math.max(1, zoneTileCount);
  const repeats = Math.max(0, completionCount);
  const decay = ZONE_REPEAT_DECAY[Math.min(ZONE_REPEAT_DECAY.length - 1, repeats)] ?? 0.45;
  const base = 26 + totalTiles * 1.08;
  return Math.max(24, Math.round(base * decay));
}
