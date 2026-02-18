import { describe, expect, it } from "vitest";
import {
  GUITAR_SOLO_POWER_KIND,
  RHYTHM_SERPENT_POWER_KINDS,
  GUITAR_SOLO_SPRITE,
  GUITAR_SOLO_PALETTE
} from "../../../src/games/rhythm-serpent/guitarSoloPowerup";

describe("rhythm serpent guitar solo power-up", () => {
  it("adds guitar-solo to power-up kinds", () => {
    expect(GUITAR_SOLO_POWER_KIND).toBe("guitar-solo");
    expect(RHYTHM_SERPENT_POWER_KINDS).toContain("guitar-solo");
  });

  it("defines a square pixel sprite with visible pixels", () => {
    expect(GUITAR_SOLO_SPRITE.length).toBeGreaterThan(12);
    expect(new Set(GUITAR_SOLO_SPRITE.map((row) => row.length)).size).toBe(1);
    expect(GUITAR_SOLO_SPRITE.length).toBe(GUITAR_SOLO_SPRITE[0]?.length ?? 0);

    let visible = 0;
    for (const row of GUITAR_SOLO_SPRITE) {
      for (const ch of row) {
        if (ch !== ".") {
          visible += 1;
          expect(GUITAR_SOLO_PALETTE[ch]).toBeDefined();
        }
      }
    }

    expect(visible).toBeGreaterThan(90);
  });
});
