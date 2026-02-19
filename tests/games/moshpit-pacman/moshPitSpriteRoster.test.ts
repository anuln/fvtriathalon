import { describe, expect, it } from "vitest";
import {
  MOSH_PIT_GUARD_VARIANTS,
  MOSH_PIT_PLAYER_SPRITE_ID,
  getMosherGuardVariant
} from "../../../src/games/moshpit-pacman/moshPitSpriteRoster";

describe("moshPit sprite roster", () => {
  it("exposes stable sprite ids for player and guard set", () => {
    expect(MOSH_PIT_PLAYER_SPRITE_ID).toBe("player_runner");
    expect(MOSH_PIT_GUARD_VARIANTS).toEqual(["bouncer", "punker", "raver"]);
  });

  it("maps guard indices to variants with wraparound", () => {
    expect(getMosherGuardVariant(0)).toBe("bouncer");
    expect(getMosherGuardVariant(1)).toBe("punker");
    expect(getMosherGuardVariant(2)).toBe("raver");
    expect(getMosherGuardVariant(3)).toBe("bouncer");
    expect(getMosherGuardVariant(-1)).toBe("raver");
  });
});
