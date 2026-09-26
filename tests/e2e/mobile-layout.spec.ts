import { expect, test } from "@playwright/test";

test("small phones can read every dialog and use the HUD", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/?qa");
  await expect(page.locator("#start")).toBeVisible({ timeout: 60000 });

  await page.getByRole("button", { name: "遊び方" }).click();
  const guide = page.locator(".overlay:not(.hidden) .dialog");
  await expect(guide).toBeVisible();
  await expect
    .poll(async () => (await guide.boundingBox())!.y)
    .toBeGreaterThanOrEqual(0);
  await page.locator("#modal-close").scrollIntoViewIfNeeded();
  await expect(page.locator("#modal-close")).toBeInViewport();
  await page.locator("#modal-close").click();

  await page.locator("#start").click();
  await page.getByRole("button", { name: "時計停止", exact: true }).click();
  const hud = await page.evaluate(() => {
    const resource = document
      .querySelector(".resource-bar")!
      .getBoundingClientRect();
    const utility = document
      .querySelector(".utilities")!
      .getBoundingClientRect();
    return {
      resourceRight: resource.right,
      utilityTop: utility.top,
      resourceBottom: resource.bottom,
    };
  });
  expect(hud.utilityTop).toBeGreaterThan(hud.resourceBottom);
  expect(hud.resourceRight).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );

  await page.evaluate(() => {
    window.infraQA.setCpu("hard");
    window.infraQA.advance(120);
  });
  const result = page.locator(".overlay:not(.hidden) .result-card");
  await expect(result).toBeVisible();
  await expect
    .poll(async () => (await result.boundingBox())!.y)
    .toBeGreaterThanOrEqual(0);
  await page.locator("#restart").scrollIntoViewIfNeeded();
  await expect(page.locator("#restart")).toBeInViewport();
});
