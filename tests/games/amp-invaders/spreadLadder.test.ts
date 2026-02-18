import { describe, expect, it } from "vitest";
import { buildPlayerVolley } from "../../../src/games/amp-invaders/spreadLadder";

describe("spreadLadder", () => {
  it("builds tier 1 as a single center shot", () => {
    const shots = buildPlayerVolley(1, 100, 200);
    expect(shots).toHaveLength(1);
    expect(shots[0].vx).toBe(0);
  });

  it("builds tier 2 as dual shots", () => {
    const shots = buildPlayerVolley(2, 100, 200);
    expect(shots).toHaveLength(2);
    expect(shots.map((shot) => shot.vx)).toEqual([-150, 150]);
  });

  it("builds tier 3 as triple shots", () => {
    const shots = buildPlayerVolley(3, 100, 200);
    expect(shots).toHaveLength(3);
    expect(shots.map((shot) => shot.vx)).toEqual([-170, 0, 170]);
  });

  it("builds tier 4 as wide spread shots", () => {
    const shots = buildPlayerVolley(4, 100, 200);
    expect(shots).toHaveLength(4);
    expect(shots.map((shot) => shot.vx)).toEqual([-220, -80, 80, 220]);
  });
});
