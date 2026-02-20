import { describe, expect, it } from "vitest";
import {
  HAPTIC_MIN_GAP_MS,
  getHapticPattern,
  shouldTriggerHaptic,
  supportsHaptics,
  type HapticKind
} from "../../src/domain/haptics";

describe("haptics", () => {
  it("exposes stable patterns for gameplay events", () => {
    expect(getHapticPattern("life-spent")).toBe(15);
    expect(getHapticPattern("stage-clear")).toEqual([30, 40, 60]);
  });

  it("requires vibrate API and touch-capable device", () => {
    const noVibrate = { maxTouchPoints: 1 };
    const desktopLike = { vibrate: () => true, maxTouchPoints: 0 };
    const mobileLike = { vibrate: () => true, maxTouchPoints: 2 };

    expect(supportsHaptics(noVibrate)).toBe(false);
    expect(supportsHaptics(desktopLike)).toBe(false);
    expect(supportsHaptics(mobileLike)).toBe(true);
  });

  it("throttles repeated haptic calls within the minimum gap", () => {
    expect(shouldTriggerHaptic(-10_000, 0)).toBe(true);
    expect(shouldTriggerHaptic(1_000, 1_000 + HAPTIC_MIN_GAP_MS - 1)).toBe(false);
    expect(shouldTriggerHaptic(1_000, 1_000 + HAPTIC_MIN_GAP_MS)).toBe(true);
  });

  it("accepts all supported haptic kinds", () => {
    const kinds: HapticKind[] = ["life-spent", "stage-clear"];
    expect(kinds.map((kind) => getHapticPattern(kind))).toHaveLength(2);
  });
});
