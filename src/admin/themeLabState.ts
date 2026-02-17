export type ThemeLabState = {
  hiddenGestureUnlocked: boolean;
};

export function createThemeLabState(initial = false): ThemeLabState {
  return {
    hiddenGestureUnlocked: initial
  };
}

export function unlockThemeLab(state: ThemeLabState): ThemeLabState {
  return {
    ...state,
    hiddenGestureUnlocked: true
  };
}
