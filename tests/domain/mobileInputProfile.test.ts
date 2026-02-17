import { describe, expect, it } from "vitest";
import {
  classifyTouchGesture,
  getMobileInputProfile,
  normalizeSteerX
} from "../../src/domain/mobileInputProfile";

describe("mobile input profile", () => {
  it("requires threshold distance before classifying swipe", () => {
    const profile = getMobileInputProfile("rhythm-serpent");

    const belowThreshold = classifyTouchGesture({
      startX: 100,
      startY: 100,
      endX: 118,
      endY: 100,
      durationMs: 80,
      touchMoved: true,
      profile
    });
    expect(belowThreshold.kind).toBe("none");

    const aboveThreshold = classifyTouchGesture({
      startX: 100,
      startY: 100,
      endX: 132,
      endY: 101,
      durationMs: 80,
      touchMoved: true,
      profile
    });
    expect(aboveThreshold).toEqual({ kind: "swipe", dir: "right" });
  });

  it("normalizes drag steering with dead-zone and clamps", () => {
    const profile = getMobileInputProfile("amp-invaders");
    expect(normalizeSteerX(50, 0, 100, profile)).toBe(0);
    expect(normalizeSteerX(84, 0, 100, profile)).toBeGreaterThan(0.5);
    expect(normalizeSteerX(-30, 0, 100, profile)).toBe(-1);
    expect(normalizeSteerX(140, 0, 100, profile)).toBe(1);
  });

  it("disambiguates tap and hold using duration", () => {
    const profile = getMobileInputProfile("moshpit-pacman");

    const tap = classifyTouchGesture({
      startX: 120,
      startY: 210,
      endX: 122,
      endY: 211,
      durationMs: 80,
      touchMoved: false,
      profile
    });
    expect(tap).toEqual({ kind: "tap" });

    const hold = classifyTouchGesture({
      startX: 120,
      startY: 210,
      endX: 121,
      endY: 211,
      durationMs: profile.holdMinMs + 20,
      touchMoved: false,
      profile
    });
    expect(hold).toEqual({ kind: "hold" });
  });
});
