import { expect, test } from "@playwright/test";

test("desktop visitors see mobile gate with QR", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("http://127.0.0.1:4173/?forceDesktopGate=1");

  await expect(page.getByText("PLAY ON MOBILE")).toBeVisible();
  await expect(page.locator("img.desktop-gate-qr")).toBeVisible();
  await expect(page.getByRole("link", { name: "OPEN ON YOUR PHONE" })).toHaveAttribute(
    "href",
    "https://fvtriathalon.vercel.app/"
  );
  await expect(page.getByTestId("start")).toHaveCount(0);
});
