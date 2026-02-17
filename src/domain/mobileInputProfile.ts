export type MobileStageId = "rhythm-serpent" | "moshpit-pacman" | "amp-invaders";
export type SwipeDir = "up" | "down" | "left" | "right";

export type MobileInputProfile = {
  swipeThresholdPx: number;
  tapMaxTravelPx: number;
  holdMinMs: number;
  steerDeadZone: number;
  steerGain: number;
};

export type TouchGestureInput = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  durationMs: number;
  touchMoved: boolean;
  profile: MobileInputProfile;
};

export type TouchGesture =
  | { kind: "swipe"; dir: SwipeDir }
  | { kind: "tap" }
  | { kind: "hold" }
  | { kind: "none" };

const PROFILES: Record<MobileStageId, MobileInputProfile> = {
  "rhythm-serpent": {
    swipeThresholdPx: 24,
    tapMaxTravelPx: 12,
    holdMinMs: 260,
    steerDeadZone: 0.06,
    steerGain: 1.2
  },
  "moshpit-pacman": {
    swipeThresholdPx: 20,
    tapMaxTravelPx: 12,
    holdMinMs: 240,
    steerDeadZone: 0.05,
    steerGain: 1.1
  },
  "amp-invaders": {
    swipeThresholdPx: 30,
    tapMaxTravelPx: 14,
    holdMinMs: 320,
    steerDeadZone: 0.08,
    steerGain: 1.8
  }
};

export function getMobileInputProfile(stage: MobileStageId): MobileInputProfile {
  return PROFILES[stage];
}

export function normalizeSteerX(
  clientX: number,
  boundsLeft: number,
  boundsWidth: number,
  profile: MobileInputProfile
): number {
  const width = Math.max(1, boundsWidth);
  const normalized = (clientX - boundsLeft) / width;
  const centered = (normalized - 0.5) * 2;
  if (Math.abs(centered) < profile.steerDeadZone) {
    return 0;
  }
  const scaled = centered * profile.steerGain;
  return Math.max(-1, Math.min(1, scaled));
}

export function classifyTouchGesture(input: TouchGestureInput): TouchGesture {
  const dx = input.endX - input.startX;
  const dy = input.endY - input.startY;
  const travel = Math.hypot(dx, dy);

  if (travel >= input.profile.swipeThresholdPx) {
    if (Math.abs(dx) >= Math.abs(dy)) {
      return { kind: "swipe", dir: dx >= 0 ? "right" : "left" };
    }
    return { kind: "swipe", dir: dy >= 0 ? "down" : "up" };
  }

  if (travel <= input.profile.tapMaxTravelPx && !input.touchMoved) {
    if (input.durationMs >= input.profile.holdMinMs) {
      return { kind: "hold" };
    }
    return { kind: "tap" };
  }

  return { kind: "none" };
}
