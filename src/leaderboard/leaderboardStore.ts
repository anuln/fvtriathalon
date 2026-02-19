export type LeaderboardEntry = {
  player: string;
  total: number;
  splits: [number, number, number] | number[];
};

type SubmitScoreInput = {
  initials: string;
  total: number;
  splits: [number, number, number] | number[];
};

type ApiLeaderboardEntry = {
  initials: string;
  total: number;
  stage1: number;
  stage2: number;
  stage3: number;
};

const MAX_ENTRIES = 20;
const API_LIMIT = 200;
const STORAGE_KEY = "festiverse.v1.leaderboard";
const API_URL = "/api/leaderboard";

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

function normalizeSplits(splits: [number, number, number] | number[]): [number, number, number] {
  const [a = 0, b = 0, c = 0] = splits;
  return [Math.round(a), Math.round(b), Math.round(c)];
}

function mapApiEntry(entry: ApiLeaderboardEntry): LeaderboardEntry {
  return {
    player: entry.initials,
    total: Math.round(entry.total),
    splits: [Math.round(entry.stage1), Math.round(entry.stage2), Math.round(entry.stage3)]
  };
}

function setEntries(next: LeaderboardEntry[]): void {
  entries = [...next]
    .sort((a, b) => b.total - a.total)
    .slice(0, MAX_ENTRIES);
}

function isLocalDevHost(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

export function saveScore(entry: LeaderboardEntry): void {
  hydrate();
  setEntries([...entries, entry]);
  persist();
}

export function topScores(): LeaderboardEntry[] {
  hydrate();
  return [...entries];
}

export async function refreshScores(limit = API_LIMIT): Promise<LeaderboardEntry[]> {
  hydrate();
  if (typeof fetch !== "function") {
    return topScores();
  }
  try {
    const response = await fetch(`${API_URL}?limit=${limit}`, {
      method: "GET",
      headers: {
        accept: "application/json"
      }
    });
    if (!response.ok) {
      if (response.status === 404 && isLocalDevHost()) {
        return topScores();
      }
      return topScores();
    }
    const payload = (await response.json()) as { entries?: ApiLeaderboardEntry[] };
    if (!Array.isArray(payload.entries)) {
      return topScores();
    }
    setEntries(payload.entries.map(mapApiEntry));
    persist();
  } catch {
    // Keep local cache on transport errors.
  }
  return topScores();
}

export async function submitScore(input: SubmitScoreInput): Promise<boolean> {
  hydrate();
  const initials = input.initials.toUpperCase();
  const [stage1, stage2, stage3] = normalizeSplits(input.splits);
  const total = Math.round(input.total);
  if (!/^[A-Z]{3}$/.test(initials) || total < 0) {
    return false;
  }
  if (typeof fetch !== "function") {
    return false;
  }
  const localEntry: LeaderboardEntry = {
    player: initials,
    total,
    splits: [stage1, stage2, stage3]
  };
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        initials,
        total,
        stage1,
        stage2,
        stage3
      })
    });
    if (!response.ok) {
      if (response.status === 404 && isLocalDevHost()) {
        setEntries([localEntry, ...entries]);
        persist();
        return true;
      }
      return false;
    }
    const payload = (await response.json()) as { entry?: ApiLeaderboardEntry };
    if (!payload.entry) {
      return false;
    }
    setEntries([mapApiEntry(payload.entry), ...entries]);
    persist();
    return true;
  } catch {
    if (isLocalDevHost()) {
      setEntries([localEntry, ...entries]);
      persist();
      return true;
    }
    return false;
  }
}
