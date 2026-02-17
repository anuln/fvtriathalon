import type { ThemePack } from "../themeTypes";

export const vintageCrt: ThemePack = {
  id: "vintage-crt-arcade",
  palette: {
    background: "#10140b",
    surface: "#1f2917",
    primary: "#8dff62",
    accent: "#f0c04a",
    text: "#e8f5d8"
  },
  typography: {
    display: "Press Start 2P",
    body: "VT323",
    mono: "Courier Prime"
  },
  motion: {
    speedMultiplier: 0.9,
    easing: "linear"
  },
  fx: {
    glow: 0.55,
    grain: 0.45,
    scanlines: 0.9
  },
  audioMix: {
    music: 0.8,
    sfx: 0.9,
    voice: 0.7
  }
};
