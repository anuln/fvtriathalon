import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("app bootstrap", () => {
  it("exposes a root app mount point", () => {
    expect(document.querySelector("#app")).toBeTruthy();
  });

  it("defines mobile safe-area layout tokens in runtime styles", () => {
    const mainPath = path.resolve(process.cwd(), "src/main.ts");
    const source = fs.readFileSync(mainPath, "utf8");

    expect(source).toContain("--safe-top");
    expect(source).toContain("--safe-bottom");
    expect(source).toContain("safe-area-inset-top");
    expect(source).toContain("safe-area-inset-bottom");
  });
});
