import { expect, test } from "@playwright/test";

test("solo result collects one optional difficulty rating with match context", async ({
  page,
}, testInfo) => {
  const submitted: unknown[] = [];
  const matches: unknown[] = [];
  await page.route(/\/(?:feedback|matches)$/, async (route) => {
    if (route.request().method() === "POST") {
      (route.request().url().endsWith("/matches") ? matches : submitted).push(
        route.request().postDataJSON(),
      );
    }
    await route.fulfill({
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  });
  await page.goto("/?qa");
  await page.locator("#start").click();
  await page.locator('[data-difficulty="easy"]').click();
  await page.locator("#cpu-start").click();
  await expect(page.locator("#match-intro")).toBeVisible();
  await expect(page.locator("#match-intro")).toBeHidden({ timeout: 15000 });
  await page.evaluate(() => {
    window.infraQA.setCpuEnabled(false);
    window.infraQA.advance(360);
  });
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator(".result-feedback-choices button")).toHaveCount(3);
  await expect.poll(() => matches.length).toBe(1);
  await page
    .locator(".result-card")
    .evaluate((card) =>
      Promise.all(card.getAnimations().map((animation) => animation.finished)),
    );
  await page.screenshot({ path: testInfo.outputPath("result-feedback.png") });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  await page.locator('[data-feedback="hard"]').click();
  await expect(page.locator("#feedback-status")).toContainText("ありがとう");
  expect(submitted).toHaveLength(1);
  expect(submitted[0]).toMatchObject({
    selectedDifficulty: "easy",
    feltDifficulty: "hard",
    outcome: "draw",
    durationSeconds: 360,
  });
  await expect(page.locator('[data-feedback="normal"]')).toBeDisabled();
  expect(matches[0]).toMatchObject({
    id: (submitted[0] as { id: string }).id,
    selectedDifficulty: "easy",
    outcome: "draw",
    durationSeconds: 360,
  });
  expect((matches[0] as { configVersion: string }).configVersion).toMatch(
    /^[0-9a-f]{8}$/,
  );
});
