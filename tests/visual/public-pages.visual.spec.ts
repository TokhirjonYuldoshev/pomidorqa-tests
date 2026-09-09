import { expect, test } from "@playwright/test";

const pages = [
  { name: "login", route: "/pomidorqa/auth/login" },
  { name: "register", route: "/pomidorqa/auth/register" },
];

test.describe("public pages visual regression", () => {
  for (const target of pages) {
    test(`${target.name} page matches baseline`, async ({ page }) => {
      await page.goto(target.route, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });

      await expect(page.locator("body")).toBeVisible();
      await page.evaluate("document.fonts.ready");

      await expect(page).toHaveScreenshot(`${target.name}-page.png`, {
        fullPage: true,
        animations: "disabled",
        caret: "hide",
        maxDiffPixelRatio: 0.01,
      });
    });
  }
});
