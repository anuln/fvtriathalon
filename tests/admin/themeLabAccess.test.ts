import { describe, expect, it } from "vitest";
import { isThemeLabEnabled } from "../../src/admin/themeLabAccess";

describe("theme lab access", () => {
  it("is disabled in player mode by default", () => {
    expect(isThemeLabEnabled({ adminFlag: false, queryFlag: false })).toBe(false);
  });
});
