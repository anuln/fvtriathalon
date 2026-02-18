import { expect, test, type Page } from "@playwright/test";

type RuntimeState = {
  stageName?: string;
  stageState?: {
    currentDir?: string;
    grid?: { cols: number; rows: number };
    player?: { x: number; y: number };
    playerHead?: { x: number; y: number };
    turnTelemetry?: {
      pendingTurns?: number;
      acceptedTurns?: number;
      expiredTurns?: number;
      rejectedTurns?: number;
      droppedTurns?: number;
      lastTurnLatencyMs?: number | null;
    };
  };
};

async function readState(page: Page): Promise<RuntimeState> {
  return page.evaluate(() => {
    const raw = (window as Window & { render_game_to_text?: () => string }).render_game_to_text?.() ?? "{}";
    return JSON.parse(raw) as RuntimeState;
  });
}

async function dispatchTouch(
  page: Page,
  type: "touchstart" | "touchmove" | "touchend",
  x: number,
  y: number
): Promise<void> {
  await page.evaluate(
    ({ touchType, touchX, touchY }) => {
      const canvas = document.querySelector("#game-canvas");
      if (!canvas) return;
      const touch = {
        clientX: touchX,
        clientY: touchY,
        pageX: touchX,
        pageY: touchY,
        screenX: touchX,
        screenY: touchY
      };
      const event = new Event(touchType, { bubbles: true, cancelable: true });
      Object.defineProperty(event, "changedTouches", { value: [touch] });
      Object.defineProperty(event, "touches", { value: touchType === "touchend" ? [] : [touch] });
      Object.defineProperty(event, "targetTouches", { value: touchType === "touchend" ? [] : [touch] });
      canvas.dispatchEvent(event);
    },
    { touchType: type, touchX: x, touchY: y }
  );
}

test.describe("mobile controls", () => {
  test("rhythm serpent applies pointer-touch swipe turns before pointerup", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://127.0.0.1:4173/");
    await page.getByTestId("start").click();

    const canvasBox = await page.locator("#game-canvas").boundingBox();
    expect(canvasBox).not.toBeNull();
    const box = canvasBox ?? { x: 0, y: 0, width: 1, height: 1 };
    const startX = box.x + box.width * 0.52;
    const startY = box.y + box.height * 0.7;

    await page.evaluate(
      ({ x, y }) => {
        const canvas = document.querySelector("#game-canvas");
        if (!canvas) return;
        canvas.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            pointerType: "touch",
            clientX: x,
            clientY: y
          })
        );
        canvas.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            pointerType: "touch",
            clientX: x,
            clientY: y - 100
          })
        );
      },
      { x: startX, y: startY }
    );

    await page.evaluate(() => {
      (window as Window & { advanceTime?: (ms: number) => void }).advanceTime?.(220);
    });

    const state = await readState(page);
    expect(state.stageName).toBe("Rhythm Serpent");
    expect(state.stageState?.currentDir).toBe("up");
  });

  test("rhythm serpent applies touch-event swipe turns (compat path)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://127.0.0.1:4173/");
    await page.getByTestId("start").click();

    const canvasBox = await page.locator("#game-canvas").boundingBox();
    expect(canvasBox).not.toBeNull();
    const box = canvasBox ?? { x: 0, y: 0, width: 1, height: 1 };
    const startX = box.x + box.width * 0.55;
    const startY = box.y + box.height * 0.74;

    await dispatchTouch(page, "touchstart", startX, startY);
    await dispatchTouch(page, "touchmove", startX, startY - 90);

    await page.evaluate(() => {
      (window as Window & { advanceTime?: (ms: number) => void }).advanceTime?.(220);
    });

    const state = await readState(page);
    expect(state.stageName).toBe("Rhythm Serpent");
    expect(state.stageState?.currentDir).toBe("up");
  });

  test("rhythm serpent uses portrait grid to occupy mobile canvas height", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://127.0.0.1:4173/");
    await page.getByTestId("start").click();

    const state = await readState(page);
    const grid = state.stageState?.grid;
    expect(grid).toBeDefined();

    const canvasBox = await page.locator("#game-canvas").boundingBox();
    expect(canvasBox).not.toBeNull();
    const box = canvasBox ?? { height: 1, width: 1 };
    const rows = grid?.rows ?? 1;
    const cols = grid?.cols ?? 1;
    const cell = Math.min(box.width / cols, box.height / rows);
    const heightCoverage = (cell * rows) / box.height;

    expect(rows).toBeGreaterThan(cols);
    expect(heightCoverage).toBeGreaterThan(0.8);
  });

  test("rhythm serpent keeps first corner turn when swipes are chained rapidly", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://127.0.0.1:4173/");
    await page.getByTestId("start").click();

    const initial = await readState(page);
    expect(initial.stageName).toBe("Rhythm Serpent");
    const startHead = initial.stageState?.playerHead;
    expect(startHead).toBeDefined();

    const canvasBox = await page.locator("#game-canvas").boundingBox();
    expect(canvasBox).not.toBeNull();
    const box = canvasBox ?? { x: 0, y: 0, width: 1, height: 1 };
    const startX = box.x + box.width * 0.52;
    const startY = box.y + box.height * 0.74;

    await page.evaluate(
      ({ x, y }) => {
        const canvas = document.querySelector("#game-canvas");
        if (!canvas) return;
        canvas.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            cancelable: true,
            pointerId: 7,
            pointerType: "touch",
            clientX: x,
            clientY: y
          })
        );
        canvas.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            cancelable: true,
            pointerId: 7,
            pointerType: "touch",
            clientX: x,
            clientY: y - 95
          })
        );
        canvas.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            cancelable: true,
            pointerId: 7,
            pointerType: "touch",
            clientX: x + 95,
            clientY: y - 95
          })
        );
      },
      { x: startX, y: startY }
    );

    await page.evaluate(() => {
      (window as Window & { advanceTime?: (ms: number) => void }).advanceTime?.(220);
    });

    const state = await readState(page);
    expect(state.stageName).toBe("Rhythm Serpent");
    expect((state.stageState?.playerHead?.y ?? Number.POSITIVE_INFINITY)).toBeLessThan(startHead?.y ?? 0);
    expect(state.stageState?.turnTelemetry?.acceptedTurns ?? 0).toBeGreaterThan(0);
  });

  test("mosh pit pac-man prioritizes earliest buffered turn in rapid swipe chains", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://127.0.0.1:4173/");
    await page.getByTestId("start").click();

    await page.evaluate(() => {
      (window as Window & { advanceTriathlonForTest?: () => void }).advanceTriathlonForTest?.();
    });

    const canvasBox = await page.locator("#game-canvas").boundingBox();
    expect(canvasBox).not.toBeNull();
    const box = canvasBox ?? { x: 0, y: 0, width: 1, height: 1 };
    const startX = box.x + box.width * 0.5;
    const startY = box.y + box.height * 0.64;

    await page.evaluate(
      ({ x, y }) => {
        const canvas = document.querySelector("#game-canvas");
        if (!canvas) return;
        canvas.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            cancelable: true,
            pointerId: 11,
            pointerType: "touch",
            clientX: x,
            clientY: y
          })
        );
        canvas.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            cancelable: true,
            pointerId: 11,
            pointerType: "touch",
            clientX: x,
            clientY: y + 92
          })
        );
        canvas.dispatchEvent(
          new PointerEvent("pointermove", {
            bubbles: true,
            cancelable: true,
            pointerId: 11,
            pointerType: "touch",
            clientX: x - 90,
            clientY: y + 92
          })
        );
        canvas.dispatchEvent(
          new PointerEvent("pointerup", {
            bubbles: true,
            cancelable: true,
            pointerId: 11,
            pointerType: "touch",
            clientX: x - 90,
            clientY: y + 92
          })
        );
      },
      { x: startX, y: startY }
    );

    await page.evaluate(() => {
      (window as Window & { advanceTime?: (ms: number) => void }).advanceTime?.(90);
    });

    const state = await readState(page);
    expect(state.stageName).toBe("Mosh Pit Pac-Man");
    expect(state.stageState?.player?.x).toBe(1);
    expect(state.stageState?.player?.y ?? 0).toBeGreaterThan(1);
    expect(state.stageState?.turnTelemetry?.pendingTurns ?? 0).toBeGreaterThan(0);
    expect(state.stageState?.turnTelemetry?.acceptedTurns ?? 0).toBeGreaterThan(0);
  });
});
