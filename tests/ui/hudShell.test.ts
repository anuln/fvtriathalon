import { describe, expect, it } from "vitest";
import { formatHud } from "../../src/ui/HudShell";

describe("hud shell", () => {
  it("shows run time, stage label, and banked tri points", () => {
    const hud = formatHud({ msLeft: 540000, stageIndex: 0, triPoints: 321 });
    expect(hud).toContain("09:00");
    expect(hud).toContain("Stage 1/3");
    expect(hud).toContain("321");
  });
});
