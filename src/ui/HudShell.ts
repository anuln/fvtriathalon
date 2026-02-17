export type HudInput = {
  msLeft: number;
  stageIndex: number;
  triPoints: number;
};

function formatTime(msLeft: number): string {
  const totalSeconds = Math.max(0, Math.floor(msLeft / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function formatHud({ msLeft, stageIndex, triPoints }: HudInput): string {
  return `TIME ${formatTime(msLeft)} | Stage ${stageIndex + 1}/3 | TRI ${triPoints}`;
}
