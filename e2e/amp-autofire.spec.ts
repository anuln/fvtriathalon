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

test("amp invaders does not collapse enemy block into instant stage loss on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4173/");
  await page.getByTestId("start").click();

  await page.evaluate(() => {
    const advance = (window as Window & { advanceTriathlonForTest?: () => void }).advanceTriathlonForTest;
    advance?.();
    advance?.();
  });

  await page.evaluate(() => {
    (window as Window & { advanceTime?: (ms: number) => void }).advanceTime?.(3000);
  });

  const state = await page.evaluate(() => {
    const json = (window as Window & { render_game_to_text?: () => string }).render_game_to_text?.() ?? "{}";
    return JSON.parse(json) as {
      mode?: string;
      stageName?: string;
      stageState?: { enemyMaxY?: number; lives?: number };
    };
  });

  expect(state.stageName).toBe("Amp Invaders");
  expect(state.mode).toBe("playing");
  expect(state.stageState?.lives ?? 0).toBeGreaterThan(0);
  expect(state.stageState?.enemyMaxY ?? Number.POSITIVE_INFINITY).toBeLessThan(420);
});

test("amp invaders touch steering moves smoothly in both directions on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4173/");
  await page.getByTestId("start").click();

  await page.evaluate(() => {
    const advance = (window as Window & { advanceTriathlonForTest?: () => void }).advanceTriathlonForTest;
    advance?.();
    advance?.();
  });

  const baseline = await page.evaluate(() => {
    const json = (window as Window & { render_game_to_text?: () => string }).render_game_to_text?.() ?? "{}";
    const parsed = JSON.parse(json) as { stageState?: { playerX?: number } };
    return parsed.stageState?.playerX ?? 0.5;
  });

  await page.evaluate(() => {
    const canvas = document.querySelector("#game-canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const startX = rect.left + rect.width * 0.5;
    const y = rect.top + rect.height * 0.82;
    canvas.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerId: 21,
        pointerType: "touch",
        clientX: startX,
        clientY: y
      })
    );
    canvas.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        cancelable: true,
        pointerId: 21,
        pointerType: "touch",
        clientX: rect.left + rect.width * 0.88,
        clientY: y
      })
    );
  });

  await page.evaluate(() => {
    (window as Window & { advanceTime?: (ms: number) => void }).advanceTime?.(380);
  });

  const movedRight = await page.evaluate(() => {
    const json = (window as Window & { render_game_to_text?: () => string }).render_game_to_text?.() ?? "{}";
    const parsed = JSON.parse(json) as { stageState?: { playerX?: number } };
    return parsed.stageState?.playerX ?? 0.5;
  });

  await page.evaluate(() => {
    const canvas = document.querySelector("#game-canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const y = rect.top + rect.height * 0.82;
    canvas.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        cancelable: true,
        pointerId: 21,
        pointerType: "touch",
        clientX: rect.left + rect.width * 0.14,
        clientY: y
      })
    );
  });

  await page.evaluate(() => {
    (window as Window & { advanceTime?: (ms: number) => void }).advanceTime?.(420);
  });

  const movedLeft = await page.evaluate(() => {
    const json = (window as Window & { render_game_to_text?: () => string }).render_game_to_text?.() ?? "{}";
    const parsed = JSON.parse(json) as { mode?: string; stageState?: { playerX?: number } };
    return { mode: parsed.mode, playerX: parsed.stageState?.playerX ?? 0.5 };
  });

  expect(movedRight).toBeGreaterThan(baseline + 0.04);
  expect(movedLeft.playerX).toBeLessThan(movedRight - 0.04);
  expect(movedLeft.mode).toBe("playing");
});
