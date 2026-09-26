import { expect, test } from "@playwright/test";

test("team reveal and countdown hold the match clock, and backdrops close dialogs", async ({
  page,
}) => {
  await page.goto("/?qa");
  await page.locator("#qa-controls").evaluate((element) => element.remove());
  await page.locator("#title .help").click();
  await expect(page.locator("#modal")).toBeVisible();
  await page.locator("#modal").click({ position: { x: 6, y: 6 } });
  await expect(page.locator("#modal")).toBeHidden();

  await page.locator("#online-start").click();
  await expect(page.locator("#online-lobby")).toBeVisible();
  await page.locator("#online-lobby").click({ position: { x: 6, y: 6 } });
  await expect(page.locator("#online-lobby")).toBeHidden();

  await page.locator("#start").click();
  await expect(page.locator("#match-intro .intro-card.blue")).toBeVisible();
  await expect(page.locator("#match-intro .intro-card.red")).toBeVisible();
  await expect(
    page.locator("#match-intro .intro-count-card strong"),
  ).toHaveText("3");
  expect(await page.evaluate(() => window.infraQA.snapshot().time)).toBe(0);
  await expect(
    page.locator("#match-intro .intro-count-card strong"),
  ).toHaveText("2");
  await expect(
    page.locator("#match-intro .intro-count-card strong"),
  ).toHaveText("1");
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#match-intro")).toBeHidden();

  await page.keyboard.press("1");
  await expect(page.locator("#task-panel")).toBeVisible();
  const canvas = page.locator("#world canvas");
  const bounds = await canvas.boundingBox();
  await canvas.click({
    position: { x: 20, y: Math.min(520, bounds!.height - 20) },
  });
  await expect(page.locator("#task-panel")).toBeHidden();

  await page.locator("#pause").click();
  await expect(page.locator("#modal")).toBeVisible();
  await page.locator("#modal").click({ position: { x: 6, y: 6 } });
  await expect(page.locator("#modal")).toBeHidden();
});
