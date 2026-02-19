const INVASION_FLOOR_PADDING = 148;

export function getEnemyInvasionFloorY(height: number): number {
  const safeHeight = Number.isFinite(height) ? Math.max(240, Math.floor(height)) : 540;
  return safeHeight - INVASION_FLOOR_PADDING;
}

export function computeEnemyDropDelta(currentMaxY: number, intendedDrop: number, invasionFloorY: number): number {
  if (!Number.isFinite(currentMaxY) || !Number.isFinite(intendedDrop) || !Number.isFinite(invasionFloorY)) {
    return 0;
  }
  const targetDrop = Math.max(0, Math.floor(intendedDrop));
  if (targetDrop <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(targetDrop, Math.floor(invasionFloorY - currentMaxY)));
}
