import { describe, expect, it } from "vitest";
import { getDefaultTheme, listThemes } from "../../src/theme/themeRegistry";

describe("theme registry", () => {
  it("defaults to neon tournament broadcast", () => {
    expect(getDefaultTheme().id).toBe("neon-tournament-broadcast");
    expect(listThemes().length).toBe(3);
  });
});
