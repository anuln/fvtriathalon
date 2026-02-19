export type SnakeAudioMode = "legacy" | "v2";
export type SnakeAudioState = "intro" | "build" | "vibe" | "hype" | "drop" | "breakdown" | "flow";
export type SnakeAudioTransitionEvent =
  | "enter-build"
  | "enter-vibe"
  | "enter-hype"
  | "enter-drop"
  | "enter-breakdown"
  | "enter-flow";

export type SnakeAudioAdvanceSample = {
  score: number;
  combo: number;
  snakeLength: number;
  scoreRate: number;
  pickupDensity: number;
  danger: boolean;
  comboMilestoneRecent: boolean;
  hasPositiveMomentum: boolean;
};

export type SnakeAudioAdvanceInput = {
  step16: number;
  nowSeconds: number;
  sample: SnakeAudioAdvanceSample;
};

export type SnakeAudioAdvanceResult = {
  state: SnakeAudioState;
  energyIndex: number;
  transitionEvent: SnakeAudioTransitionEvent | null;
};

const EIGHT_BARS_STEP16 = 128;
const DROP_ENERGY_THRESHOLD = 0.78;
const DROP_ENERGY_BARS_REQUIRED = 2;
const DANGER_SHOCK_SECONDS = 6;
const STAGE_THRESHOLDS: Record<"build" | "vibe" | "hype", number> = {
  build: 0.22,
  vibe: 0.38,
  hype: 0.58
};

function clamp(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function stateRank(state: SnakeAudioState): number {
  if (state === "intro") return 0;
  if (state === "build") return 1;
  if (state === "vibe") return 2;
  if (state === "hype") return 3;
  if (state === "drop") return 4;
  if (state === "breakdown") return 5;
  return 6;
}

function energyIndex(sample: SnakeAudioAdvanceSample): number {
  const scoreNorm = clamp(0, sample.score / 1200, 1);
  const comboNorm = clamp(0, sample.combo / 10, 1);
  const lengthNorm = clamp(0, (sample.snakeLength - 3) / 15, 1);
  const scoreRateNorm = clamp(0, sample.scoreRate / 60, 1);
  const pickupNorm = clamp(0, sample.pickupDensity, 1);
  const dangerPenalty = sample.danger ? 0.25 : 0;

  return clamp(
    0,
    comboNorm * 0.35 + scoreRateNorm * 0.25 + lengthNorm * 0.2 + pickupNorm * 0.1 + scoreNorm * 0.1 - dangerPenalty,
    1
  );
}

export function resolveSnakeAudioMode(search: string, fallback: SnakeAudioMode = "v2"): SnakeAudioMode {
  const mode = new URLSearchParams(search).get("snakeAudioMode");
  if (mode === "legacy" || mode === "v2") {
    return mode;
  }
  return fallback;
}

export function createSnakeAudioDirector() {
  let state: SnakeAudioState = "intro";
  let stateFloor = stateRank("intro");
  let lastBoundaryStep16 = -1;
  let dropTriggered = false;
  let highEnergyBars = 0;
  let lastDangerAtSeconds = Number.NEGATIVE_INFINITY;

  function transition(next: SnakeAudioState): SnakeAudioTransitionEvent | null {
    if (next === state) {
      return null;
    }
    state = next;
    stateFloor = Math.max(stateFloor, stateRank(next));
    if (next === "build") return "enter-build";
    if (next === "vibe") return "enter-vibe";
    if (next === "hype") return "enter-hype";
    if (next === "drop") return "enter-drop";
    if (next === "breakdown") return "enter-breakdown";
    return "enter-flow";
  }

  return {
    reset(): void {
      state = "intro";
      stateFloor = stateRank("intro");
      lastBoundaryStep16 = -1;
      dropTriggered = false;
      highEnergyBars = 0;
      lastDangerAtSeconds = Number.NEGATIVE_INFINITY;
    },
    getState(): SnakeAudioState {
      return state;
    },
    advance(input: SnakeAudioAdvanceInput): SnakeAudioAdvanceResult {
      const score = energyIndex(input.sample);
      let transitionEvent: SnakeAudioTransitionEvent | null = null;

      if (input.sample.danger) {
        lastDangerAtSeconds = input.nowSeconds;
      }

      const isBoundary = input.step16 % EIGHT_BARS_STEP16 === 0;
      const alreadyProcessedBoundary = lastBoundaryStep16 === input.step16;

      if (isBoundary && !alreadyProcessedBoundary) {
        lastBoundaryStep16 = input.step16;

        if (state === "drop") {
          transitionEvent = transition("breakdown");
        } else if (state === "breakdown") {
          transitionEvent = transition("flow");
        } else if (state !== "flow") {
          const dangerShockActive = input.nowSeconds - lastDangerAtSeconds <= DANGER_SHOCK_SECONDS;
          const scoreFloor = stateFloor;
          if (scoreFloor <= stateRank("intro") && score >= STAGE_THRESHOLDS.build) {
            transitionEvent = transition("build");
          } else if (scoreFloor <= stateRank("build") && score >= STAGE_THRESHOLDS.vibe) {
            transitionEvent = transition("vibe");
          } else if (scoreFloor <= stateRank("vibe") && score >= STAGE_THRESHOLDS.hype) {
            transitionEvent = transition("hype");
          } else if (!dropTriggered && state === "hype") {
            if (score >= DROP_ENERGY_THRESHOLD) {
              highEnergyBars += 1;
            } else {
              highEnergyBars = 0;
            }
            const dropReady =
              highEnergyBars >= DROP_ENERGY_BARS_REQUIRED &&
              input.sample.comboMilestoneRecent &&
              input.sample.hasPositiveMomentum &&
              !dangerShockActive;
            if (dropReady) {
              transitionEvent = transition("drop");
              dropTriggered = true;
              highEnergyBars = 0;
            }
          }
        }
      }

      return {
        state,
        energyIndex: score,
        transitionEvent
      };
    }
  };
}
