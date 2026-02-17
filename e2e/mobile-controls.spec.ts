import { expect, test, type Page } from "@playwright/test";

type RuntimeState = {
  stageName?: string;
  stageState?: {
    currentDir?: string;
    grid?: { cols: number; rows: number };
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

  test("rhythm serpent applies swipe turns before touchend", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://127.0.0.1:4173/");
    await page.getByTestId("start").click();
    const touchPrimary = await page.evaluate(() => !("PointerEvent" in window));
    test.skip(!touchPrimary, "Touch events are fallback-only when PointerEvent is available.");

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
});
