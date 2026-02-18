import { describe, expect, it } from "vitest";
import { createSpecialsState, updateSpecials } from "../../../src/games/amp-invaders/specials";
import { STAGE3_V2_DEFAULT_CONFIG } from "../../../src/games/amp-invaders/stage3v2Config";

describe("specials", () => {
  it("spawns dive bomber on wave 3 after cooldown", () => {
    const state = createSpecialsState(STAGE3_V2_DEFAULT_CONFIG);

    updateSpecials(state, {
      dtMs: 100,
      elapsedMs: 11_200,
      wave: 3,
      width: 900,
      height: 600,
      bossActive: false
    });

    expect(state.totalSpawns).toBe(1);
    expect(state.lastSpawnKind).toBe("diveBomber");
    expect(state.entities[0]?.state).toBe("telegraph");
  });

  it("transitions telegraph into diving state", () => {
    const state = createSpecialsState(STAGE3_V2_DEFAULT_CONFIG);
    updateSpecials(state, {
      dtMs: 100,
      elapsedMs: 11_200,
      wave: 3,
      width: 900,
      height: 600,
      bossActive: false
    });

    const telegraphMs = state.entities[0]?.telegraphMsRemaining ?? 0;
    updateSpecials(state, {
      dtMs: telegraphMs + 16,
      elapsedMs: 11_200 + telegraphMs + 16,
      wave: 3,
      width: 900,
      height: 600,
      bossActive: false
    });

    expect(state.entities[0]?.state).toBe("diving");
  });

  it("keeps at most one high-threat special active before boss", () => {
    const state = createSpecialsState(STAGE3_V2_DEFAULT_CONFIG);
    updateSpecials(state, {
      dtMs: 100,
      elapsedMs: 30_000,
      wave: 4,
      width: 900,
      height: 600,
      bossActive: false
    });

    updateSpecials(state, {
      dtMs: 100,
      elapsedMs: 45_000,
      wave: 4,
      width: 900,
      height: 600,
      bossActive: false
    });

    expect(state.entities.length).toBe(1);
  });
});
