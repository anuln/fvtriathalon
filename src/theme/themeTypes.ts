export type ThemePack = {
  id: string;
  palette: {
    background: string;
    surface: string;
    primary: string;
    accent: string;
    text: string;
  };
  typography: {
    display: string;
    body: string;
    mono: string;
  };
  motion: {
    speedMultiplier: number;
    easing: string;
  };
  fx: {
    glow: number;
    grain: number;
    scanlines: number;
  };
  audioMix: {
    music: number;
    sfx: number;
    voice: number;
  };
};
