import { expect, test } from "@playwright/test";

test("match BGM loads, loops, pauses, mutes and stops with the match", async ({
  page,
}) => {
  const musicState = () =>
    page.locator("#bgm").evaluate((element) => {
      const music = element as HTMLAudioElement;
      return {
        paused: music.paused,
        loop: music.loop,
        time: music.currentTime,
      };
    });

  await page.goto("/?qa");
  await expect(page.locator("#start")).toBeVisible();
  const fetched = page.waitForResponse((r) =>
    r.url().endsWith("/audio/infra-rush-loop.mp3"),
  );
  await page.locator("#start").click();
  expect((await fetched).status()).toBe(200);
  await expect.poll(async () => (await musicState())?.paused).toBe(false);
  expect((await musicState())?.loop).toBe(true);

  await page.locator("#pause").click();
  await expect.poll(async () => (await musicState())?.paused).toBe(true);
  await page.locator("#modal-close").click();
  await expect.poll(async () => (await musicState())?.paused).toBe(false);

  await page.locator("#sound").click();
  await expect(page.locator("#sound")).toHaveAttribute("aria-pressed", "true");
  await page.locator("#sound").click();
  await expect(page.locator("#sound")).toHaveAttribute("aria-pressed", "false");

  await page.locator("#pause").click();
  await page.locator("#back-title").click();
  await expect.poll(async () => (await musicState())?.paused).toBe(true);
  expect((await musicState())?.time).toBe(0);
});
