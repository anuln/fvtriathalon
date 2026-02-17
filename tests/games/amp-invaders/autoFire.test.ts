import { describe, expect, it } from "vitest";
import { stepAutoFire } from "../../../src/games/amp-invaders/autoFire";

describe("stepAutoFire", () => {
  it("emits continuous shots at fixed cadence without button presses", () => {
    let cooldownMs = 0;

    const a = stepAutoFire(cooldownMs, 90, 180);
    cooldownMs = a.cooldownMs;
    expect(a.shots).toBe(1);

    const b = stepAutoFire(cooldownMs, 90, 180);
    cooldownMs = b.cooldownMs;
    expect(b.shots).toBe(1);

    const c = stepAutoFire(cooldownMs, 90, 180);
    expect(c.shots).toBe(0);
  });
});
