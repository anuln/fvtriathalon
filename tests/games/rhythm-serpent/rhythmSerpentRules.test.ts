import { describe, expect, it } from "vitest";
import { shouldUnlockCommit } from "../../../src/games/rhythm-serpent/rhythmSerpentConfig";

describe("rhythm serpent stage unlock", () => {
  it("unlocks at 60s", () => {
    expect(shouldUnlockCommit(60000)).toBe(true);
  });
});
