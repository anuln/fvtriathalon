import { describe, expect, it } from "vitest";
import {
  createSnakeAudioDirector,
  resolveSnakeAudioMode,
  resolveSnakePhaseVisual,
  type SnakeAudioState
} from "../../../src/games/rhythm-serpent/snakeAudioDirector";

type AdvanceSample = {
  score: number;
  combo: number;
  snakeLength: number;
  scoreRate: number;
  pickupDensity: number;
  elapsedSeconds?: number;
  danger: boolean;
  comboMilestoneRecent: boolean;
  hasPositiveMomentum: boolean;
};

function stepBoundary(step16: number): number {
  return step16 * 0.125;
}

function feedBoundary(
  director: ReturnType<typeof createSnakeAudioDirector>,
  step16: number,
  sample: AdvanceSample
) {
  return director.advance({
    step16,
    nowSeconds: stepBoundary(step16),
    sample
  });
}

function pushArcToHype(director: ReturnType<typeof createSnakeAudioDirector>): void {
  const calm: AdvanceSample = {
    score: 20,
    combo: 1,
    snakeLength: 4,
    scoreRate: 4,
    pickupDensity: 0.1,
    danger: false,
    comboMilestoneRecent: false,
    hasPositiveMomentum: false
  };
  const build: AdvanceSample = {
    score: 120,
    combo: 2,
    snakeLength: 6,
    scoreRate: 18,
    pickupDensity: 0.3,
    danger: false,
    comboMilestoneRecent: false,
    hasPositiveMomentum: true
  };
  const vibe: AdvanceSample = {
    score: 320,
    combo: 4,
    snakeLength: 8,
    scoreRate: 30,
    pickupDensity: 0.55,
    danger: false,
    comboMilestoneRecent: false,
    hasPositiveMomentum: true
  };
  const hype: AdvanceSample = {
    score: 540,
    combo: 6,
    snakeLength: 11,
    scoreRate: 42,
    pickupDensity: 0.8,
    danger: false,
    comboMilestoneRecent: true,
    hasPositiveMomentum: true
  };

  feedBoundary(director, 0, calm);
  feedBoundary(director, 128, build);
  feedBoundary(director, 256, vibe);
  feedBoundary(director, 384, hype);
}

describe("resolveSnakeAudioMode", () => {
  it("defaults to v2 when no query param is provided", () => {
    expect(resolveSnakeAudioMode("")).toBe("v2");
  });

  it("accepts explicit legacy mode", () => {
    expect(resolveSnakeAudioMode("?snakeAudioMode=legacy")).toBe("legacy");
  });

  it("falls back to v2 for unknown values", () => {
    expect(resolveSnakeAudioMode("?snakeAudioMode=weird")).toBe("v2");
  });
});

describe("createSnakeAudioDirector", () => {
  it("does not force a drop when performance never satisfies drop conditions", () => {
    const director = createSnakeAudioDirector();
    pushArcToHype(director);

    const weak: AdvanceSample = {
      score: 600,
      combo: 3,
      snakeLength: 10,
      scoreRate: 14,
      pickupDensity: 0.2,
      danger: false,
      comboMilestoneRecent: false,
      hasPositiveMomentum: false
    };

    const states: SnakeAudioState[] = [];
    for (let i = 0; i < 10; i += 1) {
      states.push(feedBoundary(director, 512 + i * 128, weak).state);
    }

    expect(states.every((state) => state === "hype")).toBe(true);
  });

  it("enters drop only after sustained high performance and then resolves to stable flow", () => {
    const director = createSnakeAudioDirector();
    pushArcToHype(director);

    const strong: AdvanceSample = {
      score: 760,
      combo: 8,
      snakeLength: 14,
      scoreRate: 58,
      pickupDensity: 1,
      danger: false,
      comboMilestoneRecent: true,
      hasPositiveMomentum: true
    };

    const preDrop = feedBoundary(director, 512, strong);
    const enterDrop = feedBoundary(director, 640, strong);
    const toBreakdown = feedBoundary(director, 768, strong);
    const toFlow = feedBoundary(director, 896, strong);
    const postFlow = feedBoundary(director, 1024, {
      ...strong,
      danger: true,
      comboMilestoneRecent: false,
      hasPositiveMomentum: false
    });

    expect(preDrop.state).toBe("hype");
    expect(enterDrop.state).toBe("drop");
    expect(enterDrop.transitionEvent).toBe("enter-drop");
    expect(toBreakdown.state).toBe("breakdown");
    expect(toFlow.state).toBe("flow");
    expect(postFlow.state).toBe("flow");
  });

  it("blocks drop when danger shock is active", () => {
    const director = createSnakeAudioDirector();
    pushArcToHype(director);

    const strongDanger: AdvanceSample = {
      score: 780,
      combo: 8,
      snakeLength: 14,
      scoreRate: 62,
      pickupDensity: 1,
      danger: true,
      comboMilestoneRecent: true,
      hasPositiveMomentum: true
    };

    feedBoundary(director, 512, strongDanger);
    const blocked = feedBoundary(director, 640, {
      ...strongDanger,
      danger: false
    });

    expect(blocked.state).toBe("hype");
  });

  it("reaches flow by 2.5 minutes under steady strong play", () => {
    const director = createSnakeAudioDirector();
    let flowAtSeconds: number | null = null;
    const sampleBase: AdvanceSample = {
      score: 500,
      combo: 7,
      snakeLength: 10,
      scoreRate: 26,
      pickupDensity: 0.45,
      danger: false,
      comboMilestoneRecent: false,
      hasPositiveMomentum: true
    };

    for (let step16 = 0; step16 <= 1280; step16 += 128) {
      const elapsed = stepBoundary(step16);
      const result = feedBoundary(director, step16, {
        ...sampleBase,
        elapsedSeconds: elapsed
      });
      if (result.state === "flow" && flowAtSeconds === null) {
        flowAtSeconds = elapsed;
      }
    }

    expect(flowAtSeconds).not.toBeNull();
    expect(flowAtSeconds ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(150);
  });
});

describe("resolveSnakePhaseVisual", () => {
  it("uses v2 labels for early states when mode is v2", () => {
    expect(resolveSnakePhaseVisual({ score: 0, mode: "v2", state: "intro" }).label).toBe("INTRO");
    expect(resolveSnakePhaseVisual({ score: 150, mode: "v2", state: "build" }).label).toBe("BUILD");
    expect(resolveSnakePhaseVisual({ score: 260, mode: "v2", state: "vibe" }).label).toBe("VIBE");
  });

  it("falls back to legacy score labels in legacy mode", () => {
    expect(resolveSnakePhaseVisual({ score: 80, mode: "legacy", state: "flow" }).label).toBe("OPENING");
    expect(resolveSnakePhaseVisual({ score: 100, mode: "legacy", state: "flow" }).label).toBe("BUILD-UP");
    expect(resolveSnakePhaseVisual({ score: 260, mode: "legacy", state: "flow" }).label).toBe("THE DROP");
  });
});
