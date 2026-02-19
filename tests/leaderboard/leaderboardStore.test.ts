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
  installStorage();
});

describe("leaderboard store", () => {
  it("hydrates from local storage and can refresh from api", async () => {
    installStorage({
      "festiverse.v1.leaderboard": JSON.stringify([
        { player: "OLD", total: 1000, splits: [300, 300, 400] }
      ])
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        entries: [
          { initials: "NEW", total: 2100, stage1: 700, stage2: 600, stage3: 800 }
        ]
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const { refreshScores, topScores } = await import("../../src/leaderboard/leaderboardStore");
    expect(topScores()[0]?.player).toBe("OLD");

    await refreshScores();

    expect(fetchMock).toHaveBeenCalledWith("/api/leaderboard?limit=200", expect.any(Object));
    expect(topScores()[0]?.player).toBe("NEW");
    expect(topScores()[0]?.splits).toEqual([700, 600, 800]);
  });

  it("submits initials/scores and updates cache", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        entry: {
          initials: "ABC",
          total: 4500,
          stage1: 1200,
          stage2: 1500,
          stage3: 1800
        }
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const { submitScore, topScores } = await import("../../src/leaderboard/leaderboardStore");

    const submitted = await submitScore({ initials: "abc", splits: [1200, 1500, 1800], total: 4500 });

    expect(submitted).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/leaderboard",
      expect.objectContaining({ method: "POST" })
    );
    expect(topScores()[0]?.player).toBe("ABC");
  });

  it("falls back to local cache in localhost dev when api route is unavailable", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "Not found" })
    });
    vi.stubGlobal("fetch", fetchMock);

    const { submitScore, topScores } = await import("../../src/leaderboard/leaderboardStore");
    const submitted = await submitScore({
      initials: "dev",
      splits: [100, 200, 300],
      total: 600
    });

    expect(submitted).toBe(true);
    expect(topScores()[0]).toEqual({
      player: "DEV",
      total: 600,
      splits: [100, 200, 300]
    });
  });
});
