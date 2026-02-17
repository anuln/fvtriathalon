import type { ThemePack } from "../themeTypes";

export const ravePoster: ThemePack = {
  id: "rave-poster-chaos",
  palette: {
    background: "#14001f",
    surface: "#2a063f",
    primary: "#ffd500",
    accent: "#00ff7a",
    text: "#fff7dc"
  },
  typography: {
    display: "Bebas Neue",
    body: "DM Sans",
    mono: "JetBrains Mono"
  },
  motion: {
    speedMultiplier: 1.1,
    easing: "ease-out"
  },
  fx: {
    glow: 0.8,
    grain: 0.3,
    scanlines: 0.1
  },
  audioMix: {
    music: 1,
    sfx: 0.95,
    voice: 0.75
  }
};
