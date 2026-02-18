import { expect, test } from "@playwright/test";

test.describe("mobile portrait smoke", () => {
  test("boots into stage 1 with no blocking overlay at 390x844", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://127.0.0.1:4173/");

    await expect(page.getByTestId("start")).toBeVisible();
    await page.getByTestId("start").click();

    await expect(page.getByText("Stage 1/3")).toBeVisible();
    await expect(page.locator("#overlay .card")).toHaveCount(0);
    await expect(page.locator(".action-rail")).toBeVisible();
    await expect(page.locator("#game-canvas")).toBeVisible();

    const safeTokens = await page.evaluate(() => {
      const rootStyle = getComputedStyle(document.documentElement);
      return {
        safeTop: rootStyle.getPropertyValue("--safe-top").trim(),
        safeBottom: rootStyle.getPropertyValue("--safe-bottom").trim()
      };
    });
    expect(safeTokens.safeTop.length).toBeGreaterThan(0);
    expect(safeTokens.safeBottom.length).toBeGreaterThan(0);

    const noPageScroll = await page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollHeight <= window.innerHeight + 1;
    });
    expect(noPageScroll).toBe(true);
  });

  test("keeps HUD and rail visible on narrow portrait width (320x568)", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("http://127.0.0.1:4173/");

    await page.getByTestId("start").click();
    await expect(page.getByText("Stage 1/3")).toBeVisible();
    await expect(page.locator(".hud")).toBeVisible();
    await expect(page.locator(".action-rail")).toBeVisible();
  });

  test("preserves render state and canvas visibility after portrait resize", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://127.0.0.1:4173/");
    await page.getByTestId("start").click();

    await page.setViewportSize({ width: 430, height: 932 });
    await page.setViewportSize({ width: 375, height: 812 });

    const state = await page.evaluate(() => {
      const toText = (window as Window & { render_game_to_text?: () => string }).render_game_to_text;
      return JSON.parse(toText?.() ?? "{}") as { stageName?: string };
    });
    expect(state.stageName).toBe("Rhythm Serpent");
    await expect(page.locator("#game-canvas")).toBeVisible();
  });

  test("stage 2 uses mobile-friendly vertical playfield occupancy", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://127.0.0.1:4173/");
    await page.getByTestId("start").click();

    await page.evaluate(() => {
      (window as Window & { advanceTriathlonForTest?: () => void }).advanceTriathlonForTest?.();
    });

    const state = await page.evaluate(() => {
      const text = (window as Window & { render_game_to_text?: () => string }).render_game_to_text?.() ?? "{}";
      return JSON.parse(text) as {
        stageName?: string;
        stageState?: { renderCoverageY?: number };
      };
    });

    expect(state.stageName).toBe("Mosh Pit Pac-Man");
    expect(state.stageState?.renderCoverageY ?? 0).toBeGreaterThan(0.68);
  });
});
