import { describe, expect, it } from "vitest";
import { saveScore, topScores } from "../../src/leaderboard/leaderboardStore";

describe("leaderboard store", () => {
  it("sorts scores descending and keeps stage splits", () => {
    saveScore({ player: "A", total: 100, splits: [30, 30, 40] });
    saveScore({ player: "B", total: 200, splits: [50, 70, 80] });
    expect(topScores()[0].player).toBe("B");
    expect(topScores()[0].splits.length).toBe(3);
  });
});
