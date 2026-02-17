export type GenreBlock = "jazz" | "rock" | "edm" | "metal";

const ORDER: GenreBlock[] = ["jazz", "rock", "edm", "metal"];

export function nextGenreBlock(current: GenreBlock): GenreBlock {
  const idx = ORDER.indexOf(current);
  if (idx === -1 || idx === ORDER.length - 1) {
    return ORDER[0];
  }

  return ORDER[idx + 1];
}
