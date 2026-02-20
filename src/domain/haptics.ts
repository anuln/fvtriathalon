export type HapticKind = "life-spent" | "stage-clear";

export const HAPTIC_MIN_GAP_MS = 120;

type HapticsCapableNavigator = {
  vibrate?: ((pattern: number | number[]) => boolean) | undefined;
  maxTouchPoints?: number;
};

export function supportsHaptics(navLike: HapticsCapableNavigator | null | undefined): boolean {
  if (!navLike) {
    return false;
  }
  const hasVibrate = typeof navLike.vibrate === "function";
  const touchPoints = Number(navLike.maxTouchPoints ?? 0);
  return hasVibrate && touchPoints > 0;
}

export function getHapticPattern(kind: HapticKind): number | number[] {
  if (kind === "stage-clear") {
    return [30, 40, 60];
  }
  return 15;
}

export function shouldTriggerHaptic(lastTriggeredAtMs: number, nowMs: number, minGapMs = HAPTIC_MIN_GAP_MS): boolean {
  return nowMs - lastTriggeredAtMs >= minGapMs;
}
