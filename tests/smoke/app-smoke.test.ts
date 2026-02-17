import { describe, expect, it } from "vitest";

describe("app bootstrap", () => {
  it("exposes a root app mount point", () => {
    expect(document.querySelector("#app")).toBeTruthy();
  });
});
