import type { ThemePack } from "../themeTypes";

export const neonTournament: ThemePack = {
  id: "neon-tournament-broadcast",
  palette: {
    background: "#05010f",
    surface: "#140a2f",
    primary: "#00ffe1",
    accent: "#ff2cfb",
    text: "#f6f4ff"
  },
  typography: {
    display: "Orbitron",
    body: "IBM Plex Sans",
    mono: "IBM Plex Mono"
  },
  motion: {
    speedMultiplier: 1,
    easing: "cubic-bezier(0.2, 0.8, 0.2, 1)"
  },
  fx: {
    glow: 0.9,
    grain: 0.2,
    scanlines: 0.4
  },
  audioMix: {
    music: 0.9,
    sfx: 1,
    voice: 0.8
  }
};
