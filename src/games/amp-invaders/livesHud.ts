export function formatAmpLivesHearts(lives: number, maxLives = 3): string {
  const clampedMaxLives = Math.max(1, Math.floor(maxLives));
  const visibleLives = Math.max(0, Math.min(clampedMaxLives, Math.floor(lives)));
  return Array.from({ length: visibleLives }, () => "❤").join(" ");
}
