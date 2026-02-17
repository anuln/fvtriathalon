import { describe, expect, it } from "vitest";
import {
  canCommitNow,
  createFlowState,
  markCommitUnlockedIfEligible,
  retryStage,
  advanceStage
} from "../../src/domain/runFlow";

describe("run flow", () => {
  it("keeps commit unlocked after retry once unlocked in a stage", () => {
    const state = createFlowState();
    state.elapsedInStageMs = 60_000;

    markCommitUnlockedIfEligible(state, false);
    expect(canCommitNow(state)).toBe(true);

    retryStage(state);
    expect(canCommitNow(state)).toBe(true);
  });

  it("advances stage index and preserves previous stage bank", () => {
    const state = createFlowState();
    state.currentStageIndex = 0;
    state.stageRaw = 420;

    advanceStage(state, 100);
    expect(state.bankedRaw[0]).toBe(420);
    expect(state.bankedTri[0]).toBe(100);
    expect(state.currentStageIndex).toBe(1);
  });

  it("unlocks commit on early death even before 60 seconds", () => {
    const state = createFlowState();
    state.elapsedInStageMs = 22_000;

    markCommitUnlockedIfEligible(state, true);
    expect(canCommitNow(state)).toBe(true);
  });
});

