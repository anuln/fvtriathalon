import { expect, test } from "@playwright/test";

test("amp invaders uses continuous auto-fire", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/");
  await page.getByTestId("start").click();

  await page.evaluate(() => {
    const advance = (window as Window & { advanceTriathlonForTest?: () => void }).advanceTriathlonForTest;
    advance?.();
    advance?.();
  });

  await page.evaluate(() => {
    (window as Window & { advanceTime?: (ms: number) => void }).advanceTime?.(900);
  });

  const state = await page.evaluate(() => {
    const json = (window as Window & { render_game_to_text?: () => string }).render_game_to_text?.() ?? "{}";
    return JSON.parse(json) as { stageName?: string; stageState?: { totalShotsFired?: number } };
  });

  expect(state.stageName).toBe("Amp Invaders");
  expect(state.stageState?.totalShotsFired ?? 0).toBeGreaterThan(0);
});

