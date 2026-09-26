import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    workNoiseCount: number;
  }
}

test("mining, construction and drilling emit work sounds, while mute silences them", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.workNoiseCount = 0;
    const original = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      window.workNoiseCount++;
      return original.call(this);
    };
  });
  const count = () => page.evaluate(() => window.workNoiseCount);
  const advance = (seconds: number) =>
    page.evaluate((n) => window.infraQA.advance(n), seconds);
  const choose = async (index: number) => {
    await page.keyboard.press(String(index));
    await expect(page.locator("#task-panel")).toBeVisible();
  };

  await page.goto("/?qa");
  await page.locator("#start").click();
  await page.locator("#tutorial-skip").click();
  await expect(page.locator("#match-intro")).toBeHidden({ timeout: 15000 });
  for (let i = 1; i <= 5; i++) {
    await choose(i);
    await page.locator('[data-action="mine"]').click();
  }
  await advance(60);
  await expect.poll(count).toBeGreaterThan(0);
  const afterMine = await count();

  await page.evaluate(() => window.infraQA.setCpuEnabled(false));
  await advance(30);
  expect(
    (await page.evaluate(() => window.infraQA.snapshot())).bridges.find(
      (bridge) => bridge.id === "red",
    )?.level,
  ).toBeGreaterThan(0);
  await choose(1);
  await page.locator('[data-action="build"]').click();
  await advance(5);
  await expect.poll(count).toBeGreaterThan(afterMine);
  const afterBuild = await count();

  await advance(23);
  await choose(1);
  await page.locator('[data-action="destroy"]').click();
  await advance(5);
  await expect.poll(count).toBeGreaterThan(afterBuild);

  await page.locator("#sound").click();
  await page.waitForTimeout(400);
  const afterMute = await count();
  await page.waitForTimeout(1300);
  expect(await count()).toBe(afterMute);
});
