import { describe, expect, it } from "vitest";
import { validateThemePack } from "../../src/theme/themeValidator";

describe("theme validator", () => {
  it("requires semantic token completeness", () => {
    const result = validateThemePack({ id: "bad" } as never);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
