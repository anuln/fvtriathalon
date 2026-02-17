import { describe, expect, it } from "vitest";
import { getStageBeatPulse } from "../../src/domain/beatPulse";

describe("getStageBeatPulse", () => {
  it("returns a strong pulse at beat start and decays within the beat", () => {
    const atStart = getStageBeatPulse("rhythm-serpent", 0);
    const midBeat = getStageBeatPulse("rhythm-serpent", 250);
    const nearNextBeat = getStageBeatPulse("rhythm-serpent", 499);

    expect(atStart).toBeGreaterThan(0.9);
    expect(midBeat).toBeLessThan(atStart);
    expect(nearNextBeat).toBeLessThan(midBeat);
  });

  it("uses stage-specific BPM values", () => {
    const rhythmAt350 = getStageBeatPulse("rhythm-serpent", 350);
    const moshAt350 = getStageBeatPulse("moshpit-pacman", 350);

    expect(rhythmAt350).not.toBe(moshAt350);
  });
});
