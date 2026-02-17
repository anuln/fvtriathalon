import { describe, expect, it } from "vitest";
import { createRunStore } from "../../src/state/runStore";

describe("run store", () => {
  it("preserves prior stage bank on retry", () => {
    const store = createRunStore();
    store.bankStage("rhythm-serpent", 500);
    store.retryCurrentStage();
    expect(store.getState().banked.rhythmSerpent).toBe(500);
  });
});
