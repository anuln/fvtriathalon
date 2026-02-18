export type ZoneMusicState = {
  milestonesByZone: number[];
  pendingStingers: number;
  intensity: number;
  activeLayers: number;
};

const MILESTONES = [0.25, 0.5, 0.75, 1];

function clamp(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function milestoneCount(progress: number): number {
  let count = 0;
  for (const mark of MILESTONES) {
    if (progress >= mark) {
      count += 1;
    }
  }
  return count;
}

export function createZoneMusicState(zoneCount: number): ZoneMusicState {
  return {
    milestonesByZone: Array.from({ length: zoneCount }, () => 0),
    pendingStingers: 0,
    intensity: 0.16,
    activeLayers: 1
  };
}

export function updateZoneMusicState(
  previous: ZoneMusicState,
  zoneCollected: number[],
  zoneTotals: number[],
  frightMs: number
): ZoneMusicState {
  const nextMilestones = [...previous.milestonesByZone];
  let pendingStingers = 0;
  let completionSum = 0;

  for (let i = 0; i < zoneTotals.length; i += 1) {
    const total = Math.max(1, zoneTotals[i] ?? 1);
    const collected = Math.max(0, zoneCollected[i] ?? 0);
    const progress = clamp(0, collected / total, 1);
    completionSum += progress;
    const reached = milestoneCount(progress);
    const prev = previous.milestonesByZone[i] ?? 0;
    if (reached > prev) {
      pendingStingers += reached - prev;
    }
    nextMilestones[i] = reached;
  }

  const zoneCount = Math.max(1, zoneTotals.length);
  const completion = completionSum / zoneCount;
  const frightBoost = frightMs > 0 ? 1 : 0;
  const intensity = clamp(0.16, 0.22 + completion * 0.62 + frightBoost * 0.12, 1);
  const activeLayers = clamp(1, 1 + Math.floor(completion * 4) + frightBoost, 6);

  return {
    milestonesByZone: nextMilestones,
    pendingStingers,
    intensity,
    activeLayers
  };
}
