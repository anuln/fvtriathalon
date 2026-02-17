import { COMMIT_UNLOCK_MS } from "./triathlonRules";

export type FlowState = {
  currentStageIndex: number;
  elapsedInStageMs: number;
  stageRaw: number;
  commitUnlockedByStage: boolean[];
  bankedRaw: number[];
  bankedTri: number[];
};

export function createFlowState(): FlowState {
  return {
    currentStageIndex: 0,
    elapsedInStageMs: 0,
    stageRaw: 0,
    commitUnlockedByStage: [false, false, false],
    bankedRaw: [0, 0, 0],
    bankedTri: [0, 0, 0]
  };
}

export function markCommitUnlockedIfEligible(state: FlowState, stageEnded: boolean): void {
  const isEarlyDeath = stageEnded && state.elapsedInStageMs < COMMIT_UNLOCK_MS;
  if (state.elapsedInStageMs >= COMMIT_UNLOCK_MS || isEarlyDeath) {
    state.commitUnlockedByStage[state.currentStageIndex] = true;
  }
}

export function canCommitNow(state: FlowState): boolean {
  return state.commitUnlockedByStage[state.currentStageIndex] === true;
}

export function retryStage(state: FlowState): void {
  state.elapsedInStageMs = 0;
  state.stageRaw = 0;
}

export function advanceStage(state: FlowState, triPointsForCurrentStage: number): void {
  const idx = state.currentStageIndex;
  state.bankedRaw[idx] = state.stageRaw;
  state.bankedTri[idx] = triPointsForCurrentStage;
  state.currentStageIndex = Math.min(2, state.currentStageIndex + 1);
  state.elapsedInStageMs = 0;
  state.stageRaw = 0;
}

