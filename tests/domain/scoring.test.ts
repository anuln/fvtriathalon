import { describe, expect, it } from "vitest";
import { toTriPoints, TOTAL_TRI_MAX } from "../../src/domain/scoring";

describe("tri points normalization", () => {
  it("uses diminishing returns and stays bounded", () => {
    const snake = toTriPoints("rhythm-serpent", 5000);
    const pac = toTriPoints("moshpit-pacman", 5000);
    const amp = toTriPoints("amp-invaders", 5000);
    expect(snake).toBeLessThanOrEqual(1200);
    expect(pac).toBeLessThanOrEqual(1200);
    expect(amp).toBeLessThanOrEqual(1200);
    expect(snake + pac + amp).toBeLessThanOrEqual(TOTAL_TRI_MAX);
  });
});
