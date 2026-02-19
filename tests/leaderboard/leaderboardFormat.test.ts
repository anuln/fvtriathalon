import { describe, expect, it } from "vitest";
import {
  formatCompactScore,
  sanitizeInitials,
  isValidInitials,
  formatEmojiLine
} from "../../src/leaderboard/leaderboardFormat";

describe("leaderboard format", () => {
  it("sanitizes initials to three uppercase letters", () => {
    expect(sanitizeInitials(" a1b!c ")).toBe("ABC");
    expect(sanitizeInitials("zzzz")).toBe("ZZZ");
    expect(sanitizeInitials("12")).toBe("");
  });

  it("validates initials strictly", () => {
    expect(isValidInitials("AB")).toBe(false);
    expect(isValidInitials("ABC")).toBe(true);
    expect(isValidInitials("AB1")).toBe(false);
  });

  it("formats compact scores", () => {
    expect(formatCompactScore(999)).toBe("999");
    expect(formatCompactScore(1000)).toBe("1.0k");
    expect(formatCompactScore(2400)).toBe("2.4k");
    expect(formatCompactScore(12_499)).toBe("12k");
  });

  it("builds compact emoji row strings", () => {
    expect(
      formatEmojiLine({
        rank: 7,
        initials: "ABC",
        splits: [1200, 950, 10400],
        total: 12_550
      })
    ).toBe("#7 ABC 🐍1.2k 🟡950 🚀10k Σ13k");
  });
});
