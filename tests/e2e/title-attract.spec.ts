import { expect, test } from "@playwright/test";

test("title shows a real CPU versus CPU match behind the menu", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/?qa");
  await expect(page.locator("#start")).toHaveText("ひとりで遊ぶ");
  await expect(page.locator("#online-start")).toHaveText("みんなで遊ぶ");
  await expect(page.locator(".title-tagline")).toContainText(
    "橋をかけて、城へ！",
  );
  await expect
    .poll(() =>
      page.evaluate(() => {
        const game = window.infraQA.attractSnapshot();
        return ["blue", "red"].every((team) =>
          game.bots.some((bot) => bot.team === team && bot.action),
        );
      }),
    )
    .toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
});
