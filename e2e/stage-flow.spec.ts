import { expect, test } from "@playwright/test";

test("stage transition uses a single summary screen with explicit raw and tri labels", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4173/");
  await page.getByTestId("start").click();

  await page.evaluate(() => {
    (window as Window & { advanceTime?: (ms: number) => void }).advanceTime?.(9000);
  });

  await expect(page.getByText("Stage Ended")).toBeVisible();
  await page.getByRole("button", { name: "BANK SCORE & CONTINUE" }).click();

  await expect(page.getByText("Move to Next Stage?")).toHaveCount(0);
  await expect(page.getByText("Stage 1 Complete")).toBeVisible();
  const summaryCard = page.locator("#overlay .card");
  await expect(summaryCard.getByText("Stage Raw Score:")).toBeVisible();
  await expect(summaryCard.getByText("Stage Tri Points:")).toBeVisible();
  await expect(summaryCard.getByText("Total Tri Points:")).toBeVisible();

  await page.getByRole("button", { name: "CONTINUE" }).click();
  await expect(page.getByText("Stage 2/3")).toBeVisible();
});
