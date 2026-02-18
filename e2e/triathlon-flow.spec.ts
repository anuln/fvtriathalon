import { test, expect } from "@playwright/test";

test("player can complete full triathlon and see results", async ({ page }) => {
  await page.goto("http://127.0.0.1:4173/");
  await page.getByText("START").click();
  await expect(page.getByText("Stage 1/3")).toBeVisible();

  await page.evaluate(() => {
    const advance = (window as Window & { advanceTriathlonForTest?: () => void }).advanceTriathlonForTest;
    advance?.();
    advance?.();
    advance?.();
    advance?.();
  });

  await expect(page.getByText("HEADLINER SCORE")).toBeVisible();
});
