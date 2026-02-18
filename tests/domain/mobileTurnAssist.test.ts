import { describe, expect, it } from "vitest";
import {
  consumeTurnIntent,
  createMobileTurnAssistState,
  enqueueTurnIntent,
  readTurnAssistTelemetry
} from "../../src/domain/mobileTurnAssist";

describe("mobile turn assist", () => {
  it("preserves chained swipe order across movement steps", () => {
    const state = createMobileTurnAssistState({ maxQueue: 4, ttlMs: 420, blockOppositeTurns: true });
    enqueueTurnIntent(state, "up", 0);
    enqueueTurnIntent(state, "right", 10);

    const first = consumeTurnIntent(state, 140, "right", () => true);
    expect(first).toBe("up");

    const second = consumeTurnIntent(state, 200, "up", () => true);
    expect(second).toBe("right");
  });

  it("keeps blocked turn buffered until the lane opens", () => {
    const state = createMobileTurnAssistState({ maxQueue: 3, ttlMs: 360, blockOppositeTurns: false });
    enqueueTurnIntent(state, "left", 0);

    expect(consumeTurnIntent(state, 60, "up", () => false)).toBeNull();
    expect(readTurnAssistTelemetry(state).pendingTurns).toBe(1);

    expect(consumeTurnIntent(state, 120, "up", () => true)).toBe("left");
    expect(readTurnAssistTelemetry(state).pendingTurns).toBe(0);
  });

  it("drops opposite turns when configured", () => {
    const state = createMobileTurnAssistState({ maxQueue: 3, ttlMs: 400, blockOppositeTurns: true });
    enqueueTurnIntent(state, "left", 0);

    expect(consumeTurnIntent(state, 40, "right", () => true)).toBeNull();
    const telemetry = readTurnAssistTelemetry(state);
    expect(telemetry.pendingTurns).toBe(0);
    expect(telemetry.rejectedTurns).toBe(1);
  });
});
