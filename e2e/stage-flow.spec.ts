import { expect, test } from "@playwright/test";

test("stage transition uses a single summary screen with score labels", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:4173/");
  await page.getByTestId("start").click();

  await page.evaluate(() => {
    (window as Window & { commitStageWithTransitionForTest?: () => void }).commitStageWithTransitionForTest?.();
  });

  await expect(page.getByText("STAGE 1 LOCKED")).toBeVisible();
  const summaryCard = page.locator("#overlay .card");
  await expect(summaryCard.getByText("Banked:")).toBeVisible();
  await expect(summaryCard.getByText("Set Total:")).toBeVisible();
  const stageScoreText = (await summaryCard.getByText(/Banked:/).textContent()) ?? "";
  const totalScoreText = (await summaryCard.getByText(/Set Total:/).textContent()) ?? "";
  const stageScore = Number(stageScoreText.replace(/[^\d-]/g, ""));
  const totalScore = Number(totalScoreText.replace(/[^\d-]/g, ""));
  expect(totalScore).toBe(stageScore);

  await page.getByRole("button", { name: "DROP IN" }).click();
  await expect(page.getByText("S2/3")).toBeVisible();
});
