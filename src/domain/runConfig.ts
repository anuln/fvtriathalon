export const DEFAULT_RUN_TOTAL_MS = 9 * 60_000;

export function resolveRunTotalMs(search: string, fallbackMs = DEFAULT_RUN_TOTAL_MS): number {
  const params = new URLSearchParams(search);
  const raw = params.get("runMinutes");
  if (!raw) {
    return fallbackMs;
  }

  const minutes = Number(raw);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return fallbackMs;
  }

  return Math.round(minutes * 60_000);
}
