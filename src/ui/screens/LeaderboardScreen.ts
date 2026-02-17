import type { LeaderboardEntry } from "../../leaderboard/leaderboardStore";

export function renderLeaderboardScreen(entries: LeaderboardEntry[]): string {
  const lines = entries.map(
    (entry, idx) => `${idx + 1}. ${entry.player} ${entry.total} (${entry.splits.join("/")})`
  );
  return ["LEADERBOARD", ...lines].join("\n");
}
