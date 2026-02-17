import { describe, expect, it } from "vitest";
import { deathChoices } from "../../../src/ui/overlays/EarlyDeathOverlay";

describe("early death options", () => {
  it("shows retry as primary action", () => {
    const options = deathChoices();
    expect(options.primary).toBe("RETRY HERE");
  });
});
