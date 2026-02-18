import { describe, expect, it } from "vitest";
import {
  bootCopy,
  deathChoiceCopy,
  deathPauseCopy,
  leaderboardCopy,
  resultsCopy,
  transitionCopy
} from "../../src/ui/festivalUxCopy";

describe("festival UX copy", () => {
  it("keeps boot onboarding brief and punchy", () => {
    expect(bootCopy.strap).toBe("3 stages. 1 timer. Chase the headline.");
    expect(bootCopy.hint).toBe("Tap in. Audio on. Crowd up.");
    expect(bootCopy.rules).toBe("Lock in after 60s. No rewinds.");
  });

  it("uses concise interim screen language", () => {
    expect(deathPauseCopy.title).toBe("SET BREAK");
    expect(deathChoiceCopy.title).toBe("CROWD CHECK");
    expect(deathChoiceCopy.primaryCta).toBe("RUN IT BACK");
    expect(deathChoiceCopy.secondaryCta).toBe("LOCK & NEXT");
  });

  it("keeps transition and results copy in the same voice", () => {
    expect(transitionCopy.cta).toBe("DROP IN");
    expect(resultsCopy.title).toBe("HEADLINER SCORE");
    expect(leaderboardCopy.title).toBe("FESTIVAL BOARD");
  });
});
