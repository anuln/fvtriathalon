import type { RunState, StageId } from "./runStore";

export type RunAction =
  | { type: "clock/set"; clockMs: number }
  | { type: "stage/set"; stage: StageId }
  | { type: "stage/commit-eligibility"; canCommit: boolean }
  | { type: "stage/retry" };

export function applyRunAction(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case "clock/set":
      return { ...state, clockMs: action.clockMs };
    case "stage/set":
      return {
        ...state,
        currentStage: action.stage,
        currentStageRaw: 0,
        currentStageTriPoints: 0,
        commitEligible: false
      };
    case "stage/commit-eligibility":
      return {
        ...state,
        commitEligible: action.canCommit
      };
    case "stage/retry":
      return {
        ...state,
        currentStageRaw: 0,
        currentStageTriPoints: 0,
        commitEligible: false
      };
    default:
      return state;
  }
}
