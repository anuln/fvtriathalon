import { expect, test } from "@playwright/test";

async function readCanvasHitTarget(page: Parameters<typeof test>[0]["page"]) {
  return page.evaluate(() => {
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
}

test("mobile gameplay hit target resolves to canvas in rhythm serpent", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4173/");
  await page.getByTestId("start").click();

  const hit = await readCanvasHitTarget(page);

  expect(hit).toMatchObject({
    topId: "game-canvas"
  });
});

test("mobile gameplay hit target resolves to canvas in mosh pit pac-man", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4173/");
  await page.getByTestId("start").click();

  await page.evaluate(() => {
    (window as Window & { advanceTriathlonForTest?: () => void }).advanceTriathlonForTest?.();
  });

  const stage = await page.evaluate(() => {
    const text = (window as Window & { render_game_to_text?: () => string }).render_game_to_text?.() ?? "{}";
    return (JSON.parse(text) as { stageName?: string }).stageName;
  });
  expect(stage).toBe("Mosh Pit Pac-Man");

  const hit = await readCanvasHitTarget(page);
  expect(hit).toMatchObject({
    topId: "game-canvas"
  });
});
