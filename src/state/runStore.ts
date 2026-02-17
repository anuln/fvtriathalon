export type StageId = "rhythm-serpent" | "moshpit-pacman" | "amp-invaders";

type BankedScores = {
  rhythmSerpent: number;
  moshpitPacman: number;
  ampInvaders: number;
};

export type RunState = {
  clockMs: number;
  currentStage: StageId;
  commitEligible: boolean;
  currentStageRaw: number;
  currentStageTriPoints: number;
  banked: BankedScores;
  bankedTriPoints: BankedScores;
};

function stageKey(stage: StageId): keyof BankedScores {
  if (stage === "rhythm-serpent") return "rhythmSerpent";
  if (stage === "moshpit-pacman") return "moshpitPacman";
  return "ampInvaders";
}

export function createRunStore() {
  const state: RunState = {
    clockMs: 0,
    currentStage: "rhythm-serpent",
    commitEligible: false,
    currentStageRaw: 0,
    currentStageTriPoints: 0,
    banked: {
      rhythmSerpent: 0,
      moshpitPacman: 0,
      ampInvaders: 0
    },
    bankedTriPoints: {
      rhythmSerpent: 0,
      moshpitPacman: 0,
      ampInvaders: 0
    }
  };

  return {
    getState(): RunState {
      return structuredClone(state);
    },
    setClock(ms: number): void {
      state.clockMs = ms;
    },
    setCurrentStage(stage: StageId): void {
      state.currentStage = stage;
      state.currentStageRaw = 0;
      state.currentStageTriPoints = 0;
      state.commitEligible = false;
    },
    setCommitEligible(canCommit: boolean): void {
      state.commitEligible = canCommit;
    },
    bankStage(stage: StageId, raw: number, triPoints = 0): void {
      const key = stageKey(stage);
      state.banked[key] = raw;
      state.bankedTriPoints[key] = triPoints;
    },
    retryCurrentStage(): void {
      state.currentStageRaw = 0;
      state.currentStageTriPoints = 0;
      state.commitEligible = false;
    }
  };
}
