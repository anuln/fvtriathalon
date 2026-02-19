export function shouldEnterBossOnWaveClear(currentWave: number, bossEntryWave: number): boolean {
  const normalizedWave = Math.max(1, Math.floor(currentWave));
  const normalizedBossEntryWave = Math.max(1, Math.floor(bossEntryWave));
  return normalizedWave + 1 >= normalizedBossEntryWave;
}
