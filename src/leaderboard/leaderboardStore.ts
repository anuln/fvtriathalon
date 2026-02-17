export type LeaderboardEntry = {
  player: string;
  total: number;
  splits: [number, number, number] | number[];
};

const MAX_ENTRIES = 20;
const STORAGE_KEY = "festiverse.v1.leaderboard";

let entries: LeaderboardEntry[] = [];

function persist(): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function saveScore(entry: LeaderboardEntry): void {
  entries = [...entries, entry].sort((a, b) => b.total - a.total).slice(0, MAX_ENTRIES);
  persist();
}

export function topScores(): LeaderboardEntry[] {
  return [...entries];
}
