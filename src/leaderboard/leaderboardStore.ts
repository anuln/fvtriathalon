export type LeaderboardEntry = {
  player: string;
  total: number;
  splits: [number, number, number] | number[];
};

const MAX_ENTRIES = 20;
const STORAGE_KEY = "festiverse.v1.leaderboard";

let entries: LeaderboardEntry[] = [];
let hydrated = false;

function isValidEntry(value: unknown): value is LeaderboardEntry {
  if (!value || typeof value !== "object") {
    return false;
  }
  const entry = value as Partial<LeaderboardEntry>;
  return (
    typeof entry.player === "string" &&
    typeof entry.total === "number" &&
    Array.isArray(entry.splits)
  );
}

function hydrate(): void {
  if (hydrated) {
    return;
  }
  hydrated = true;
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) {
      return;
    }
    entries = parsed.filter(isValidEntry).slice(0, MAX_ENTRIES);
  } catch {
    entries = [];
  }
}

function persist(): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function saveScore(entry: LeaderboardEntry): void {
  hydrate();
  entries = [...entries, entry].sort((a, b) => b.total - a.total).slice(0, MAX_ENTRIES);
  persist();
}

export function topScores(): LeaderboardEntry[] {
  hydrate();
  return [...entries];
}
