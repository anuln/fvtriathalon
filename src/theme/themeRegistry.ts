import type { ThemePack } from "./themeTypes";
import { neonTournament } from "./packs/neonTournament";
import { ravePoster } from "./packs/ravePoster";
import { vintageCrt } from "./packs/vintageCrt";

const THEMES: ThemePack[] = [neonTournament, ravePoster, vintageCrt];

export function listThemes(): ThemePack[] {
  return [...THEMES];
}

export function getDefaultTheme(): ThemePack {
  return neonTournament;
}
