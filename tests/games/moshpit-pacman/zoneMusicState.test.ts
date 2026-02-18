import { describe, expect, it } from "vitest";
import { createZoneMusicState, updateZoneMusicState } from "../../../src/games/moshpit-pacman/zoneMusicState";

describe("zone music state", () => {
  it("advances zone milestones at 25/50/75/100 percent", () => {
    let state = createZoneMusicState(5);
    state = updateZoneMusicState(state, [24, 0, 0, 0, 0], [100, 100, 100, 100, 100], 0);
    expect(state.pendingStingers).toBe(0);

    state = updateZoneMusicState(state, [25, 0, 0, 0, 0], [100, 100, 100, 100, 100], 0);
    expect(state.pendingStingers).toBe(1);

    state = updateZoneMusicState(state, [50, 0, 0, 0, 0], [100, 100, 100, 100, 100], 0);
    expect(state.pendingStingers).toBe(1);
  });

  it("triggers stingers only once per reached milestone", () => {
    let state = createZoneMusicState(5);
    state = updateZoneMusicState(state, [75, 0, 0, 0, 0], [100, 100, 100, 100, 100], 0);
    expect(state.pendingStingers).toBe(3);

    const sameFrame = updateZoneMusicState(state, [75, 0, 0, 0, 0], [100, 100, 100, 100, 100], 0);
    expect(sameFrame.pendingStingers).toBe(0);
  });

  it("adds fright-mode layer boost", () => {
    let state = createZoneMusicState(5);
    state = updateZoneMusicState(state, [40, 40, 40, 40, 40], [100, 100, 100, 100, 100], 0);
    const baseLayers = state.activeLayers;

    const fright = updateZoneMusicState(state, [40, 40, 40, 40, 40], [100, 100, 100, 100, 100], 1200);
    expect(fright.activeLayers).toBeGreaterThan(baseLayers);
    expect(fright.intensity).toBeGreaterThan(state.intensity);
  });
});
