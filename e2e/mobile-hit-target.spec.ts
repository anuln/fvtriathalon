import { expect, test } from "@playwright/test";

test("mobile gameplay hit target resolves to canvas", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4173/");
  await page.getByTestId("start").click();

  const hit = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
    if (!canvas) return { error: "missing-canvas" };
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(rect.left + rect.width * 0.5);
    const y = Math.floor(rect.top + rect.height * 0.65);
    const top = document.elementFromPoint(x, y) as HTMLElement | null;
    return {
      x,
      y,
      topId: top?.id ?? null,
      topClass: top?.className ?? null,
      topTag: top?.tagName ?? null,
      overlayPointerEvents:
        getComputedStyle(document.querySelector<HTMLElement>("#overlay") ?? document.body).pointerEvents
    };
  });

  expect(hit).toMatchObject({
    topId: "game-canvas"
  });
});
