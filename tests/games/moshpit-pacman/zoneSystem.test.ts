import { describe, expect, it } from "vitest";
import { zoneActive } from "../../../src/games/moshpit-pacman/zoneSystem";

describe("zone activation", () => {
  it("activates at 15 percent completion", () => {
    expect(zoneActive(15, 100)).toBe(true);
  });
});
