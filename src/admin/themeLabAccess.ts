export const ADMIN_THEME_TOOLS = true;

export type ThemeLabFlags = {
  adminFlag: boolean;
  queryFlag: boolean;
  hiddenGestureUnlocked?: boolean;
  isProduction?: boolean;
};

export function isThemeLabEnabled({
  adminFlag,
  queryFlag,
  hiddenGestureUnlocked = false,
  isProduction = false
}: ThemeLabFlags): boolean {
  if (!ADMIN_THEME_TOOLS) {
    return false;
  }

  if (adminFlag && hiddenGestureUnlocked) {
    return true;
  }

  return !isProduction && queryFlag;
}
