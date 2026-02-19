import { expect, test } from "@playwright/test";

test("desktop visitors see mobile gate with QR", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("http://127.0.0.1:4173/?forceDesktopGate=1");

  await expect(page.getByText("PLAY ON MOBILE")).toBeVisible();
  await expect(page.getByText("🐍 Rhythm Serpent")).toBeVisible();
  await expect(page.getByText("👻 Mosh Pit Pac-Man")).toBeVisible();
  await expect(page.getByText("🚀 Amp Invaders")).toBeVisible();
  await expect(page.getByText("🏆")).toHaveCount(0);
  await expect(page.locator("img.desktop-gate-qr")).toBeVisible();
  await expect(page.getByRole("link", { name: "OPEN ON YOUR PHONE" })).toHaveAttribute(
    "href",
    "https://fvtriathalon.vercel.app/"
  );
  await page.getByRole("button", { name: "VIEW GLOBAL LEADERBOARD" }).click();
  await expect(page.getByText("FESTIVAL BOARD")).toBeVisible();
  await page.getByRole("button", { name: "BACK" }).click();
  await expect(page.getByText("PLAY ON MOBILE")).toBeVisible();
  await expect(page.getByTestId("start")).toHaveCount(0);
});
