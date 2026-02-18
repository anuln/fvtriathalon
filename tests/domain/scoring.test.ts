import { describe, expect, it } from "vitest";
import { toTriPoints, TOTAL_TRI_MAX } from "../../src/domain/scoring";

describe("tri points normalization", () => {
  it("converts snake raw score more favorably than the other stages at the same raw", () => {
    const raw = 1500;
    const snake = toTriPoints("rhythm-serpent", raw);
    const pac = toTriPoints("moshpit-pacman", raw);
    const amp = toTriPoints("amp-invaders", raw);

    expect(snake).toBeGreaterThan(pac);
    expect(pac).toBeGreaterThan(amp);
  });

  it("uses diminishing returns and stays bounded", () => {
    const snake = toTriPoints("rhythm-serpent", 6000);
    const pac = toTriPoints("moshpit-pacman", 6000);
    const amp = toTriPoints("amp-invaders", 6000);
    expect(snake).toBeLessThanOrEqual(1200);
    expect(pac).toBeLessThanOrEqual(1200);
    expect(amp).toBeLessThanOrEqual(1200);
    expect(snake + pac + amp).toBeLessThanOrEqual(TOTAL_TRI_MAX);
  });
});
