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

test("amp invaders exposes stage3 v2 progression state", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/");
  await page.getByTestId("start").click();

  await page.evaluate(() => {
    const advance = (window as Window & { advanceTriathlonForTest?: () => void }).advanceTriathlonForTest;
    advance?.();
    advance?.();
  });

  const state = await page.evaluate(() => {
    const json = (window as Window & { render_game_to_text?: () => string }).render_game_to_text?.() ?? "{}";
    return JSON.parse(json) as {
      stageName?: string;
      stageState?: { wave?: number; genre?: string; spreadTier?: number; nextUpgradeWave?: number | null };
    };
  });

  expect(state.stageName).toBe("Amp Invaders");
  expect(state.stageState?.wave).toBe(1);
  expect(state.stageState?.genre).toBe("pop");
  expect(state.stageState?.spreadTier).toBe(1);
  expect(state.stageState?.nextUpgradeWave).toBe(2);
});

test("amp invaders upgrades spread tier after a wave clear", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/");
  await page.getByTestId("start").click();

  await page.evaluate(() => {
    const advance = (window as Window & { advanceTriathlonForTest?: () => void }).advanceTriathlonForTest;
    advance?.();
    advance?.();
  });

  await page.evaluate(() => {
    (window as Window & { advanceAmpWaveForTest?: () => void }).advanceAmpWaveForTest?.();
  });

  const state = await page.evaluate(() => {
    const json = (window as Window & { render_game_to_text?: () => string }).render_game_to_text?.() ?? "{}";
    return JSON.parse(json) as {
      stageName?: string;
      stageState?: { wave?: number; genre?: string; spreadTier?: number; nextUpgradeWave?: number | null };
    };
  });

  expect(state.stageName).toBe("Amp Invaders");
  expect(state.stageState?.wave).toBe(2);
  expect(state.stageState?.genre).toBe("edm");
  expect(state.stageState?.spreadTier).toBe(2);
  expect(state.stageState?.nextUpgradeWave).toBe(3);
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

test("amp invaders touch steering tracks thumb position with low error", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4173/");
  await page.getByTestId("start").click();

  await page.evaluate(() => {
    const advance = (window as Window & { advanceTriathlonForTest?: () => void }).advanceTriathlonForTest;
    advance?.();
    advance?.();
  });

  await page.evaluate(() => {
    const canvas = document.querySelector("#game-canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const y = rect.top + rect.height * 0.82;
    canvas.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerId: 31,
        pointerType: "touch",
        clientX: rect.left + rect.width * 0.5,
        clientY: y
      })
    );
    canvas.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        cancelable: true,
        pointerId: 31,
        pointerType: "touch",
        clientX: rect.left + rect.width * 0.86,
        clientY: y
      })
    );
  });

  await page.evaluate(() => {
    (window as Window & { advanceTime?: (ms: number) => void }).advanceTime?.(240);
  });

  const rightState = await page.evaluate(() => {
    const json = (window as Window & { render_game_to_text?: () => string }).render_game_to_text?.() ?? "{}";
    return JSON.parse(json) as {
      stageName?: string;
      mode?: string;
      stageState?: { playerX?: number; controlTelemetry?: { steerError?: number; touchSteerActive?: boolean } };
    };
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
        pointerId: 31,
        pointerType: "touch",
        clientX: rect.left + rect.width * 0.14,
        clientY: y
      })
    );
  });

  await page.evaluate(() => {
    (window as Window & { advanceTime?: (ms: number) => void }).advanceTime?.(260);
  });

  const leftState = await page.evaluate(() => {
    const json = (window as Window & { render_game_to_text?: () => string }).render_game_to_text?.() ?? "{}";
    return JSON.parse(json) as {
      stageName?: string;
      mode?: string;
      stageState?: { playerX?: number; controlTelemetry?: { steerError?: number; touchSteerActive?: boolean } };
    };
  });

  expect(rightState.stageName).toBe("Amp Invaders");
  expect(rightState.mode).toBe("playing");
  expect(rightState.stageState?.playerX ?? 0).toBeGreaterThan(0.72);
  expect(rightState.stageState?.controlTelemetry?.touchSteerActive).toBe(true);
  expect(rightState.stageState?.controlTelemetry?.steerError ?? 1).toBeLessThan(0.18);

  expect(leftState.stageName).toBe("Amp Invaders");
  expect(leftState.mode).toBe("playing");
  expect(leftState.stageState?.playerX ?? 1).toBeLessThan(0.3);
  expect(leftState.stageState?.controlTelemetry?.touchSteerActive).toBe(true);
  expect(leftState.stageState?.controlTelemetry?.steerError ?? 1).toBeLessThan(0.18);
});
