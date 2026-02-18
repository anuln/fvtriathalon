import { beforeEach, describe, expect, it, vi } from "vitest";

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

function installStorage(seed: Record<string, string> = {}): StorageLike {
  const store = new Map<string, string>(Object.entries(seed));
  const api: StorageLike = {
    getItem(key: string) {
      return store.has(key) ? (store.get(key) ?? null) : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    }
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: api
  });
  return api;
}

beforeEach(() => {
  vi.resetModules();
});

describe("leaderboard store", () => {
  it("hydrates scores from localStorage before reads", async () => {
    installStorage({
      "festiverse.v1.leaderboard": JSON.stringify([
        { player: "NEONFOX", total: 3300, splits: [1100, 1050, 1150] }
      ])
    });

    const { topScores } = await import("../../src/leaderboard/leaderboardStore");
    const scores = topScores();

    expect(scores).toHaveLength(1);
    expect(scores[0]?.player).toBe("NEONFOX");
  });

  it("sorts descending and persists after save", async () => {
    const storage = installStorage();
    const { saveScore, topScores } = await import("../../src/leaderboard/leaderboardStore");

    saveScore({ player: "A", total: 100, splits: [30, 30, 40] });
    saveScore({ player: "B", total: 200, splits: [50, 70, 80] });

    expect(topScores()[0]?.player).toBe("B");
    expect(topScores()[0]?.splits.length).toBe(3);
    expect(storage.getItem("festiverse.v1.leaderboard")).toContain("\"player\":\"B\"");
  });
});
