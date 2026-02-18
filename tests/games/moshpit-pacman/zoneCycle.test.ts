import { describe, expect, it } from "vitest";
import { ZONE_LEVEL_STEP, computeZoneCompletionBonus, zonesReadyForRespawn } from "../../../src/games/moshpit-pacman/zoneCycle";

describe("computeZoneCompletionBonus", () => {
  it("awards a moderate first-clear bonus scaled by zone size", () => {
    expect(computeZoneCompletionBonus(21, 0)).toBe(52);
    expect(computeZoneCompletionBonus(55, 0)).toBe(91);
  });

  it("decays bonus on repeated zone clears to prevent score skew", () => {
    const first = computeZoneCompletionBonus(24, 0);
    const second = computeZoneCompletionBonus(24, 1);
    const third = computeZoneCompletionBonus(24, 2);
    const fourthPlus = computeZoneCompletionBonus(24, 4);

    expect(second).toBeLessThan(first);
    expect(third).toBeLessThan(second);
    expect(fourthPlus).toBeLessThanOrEqual(third);
  });

  it("applies a floor so repeated clears still feel rewarding", () => {
    expect(computeZoneCompletionBonus(21, 9)).toBe(24);
  });
});

describe("zonesReadyForRespawn", () => {
  it("returns zone indexes that are fully collected", () => {
    expect(zonesReadyForRespawn([21, 10, 22, 24, 40], [21, 21, 22, 24, 55])).toEqual([0, 2, 3]);
  });

  it("ignores zones with zero totals", () => {
    expect(zonesReadyForRespawn([0, 0], [0, 5])).toEqual([]);
  });
});

describe("ZONE_LEVEL_STEP", () => {
  it("keeps level-up cadence coarse enough to avoid runaway speed", () => {
    expect(ZONE_LEVEL_STEP).toBe(6);
  });
});
