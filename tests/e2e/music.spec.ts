import { expect, test } from "@playwright/test";

test("title, match and result music follow the screen and audio controls", async ({
  page,
}) => {
  const paused = (selector: string) =>
    page
      .locator(selector)
      .evaluate((element) => (element as HTMLAudioElement).paused);

  await page.goto("/?qa");
  await expect(page.locator("#start")).toBeVisible({ timeout: 60000 });
  // The development-only metrics panel overlaps the title sound button on phones.
  await page.locator("#qa-controls").evaluate((element) => element.remove());
  const title = page.locator("#bgm-title");
  await expect(title).toHaveJSProperty("loop", true);
  await expect
    .poll(() =>
      page
        .locator(".logo-dot")
        .evaluate((element) => getComputedStyle(element).animationName),
    )
    .toContain("title-dot-hop");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator("#start").click();
  await page.getByRole("button", { name: "はじめて", exact: true }).click();
  await expect.poll(() => paused("#bgm-title")).toBe(false);

  await page.locator("#title-sound").click();
  await expect(page.locator("#title-sound")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator("#title-sound").click();
  await expect(page.locator("#title-sound")).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  await page.locator(".title-top .help").click();
  await expect.poll(() => paused("#bgm-title")).toBe(true);
  await page.locator("#modal-close").click();
  await expect.poll(() => paused("#bgm-title")).toBe(false);

  await page.locator("#cpu-start").click();
  await expect(page.locator("#scene-wipe")).not.toHaveClass(/active/);
  await expect.poll(() => paused("#bgm")).toBe(false);
  await expect.poll(() => paused("#bgm-title")).toBe(true);
  await page.locator("#pause").click();
  await expect.poll(() => paused("#bgm")).toBe(true);
  await page.locator("#modal-close").click();
  await expect.poll(() => paused("#bgm")).toBe(false);

  await page.evaluate(() => {
    window.infraQA.setCpuEnabled(false);
    window.infraQA.advance(360);
  });
  await expect(page.locator("#result")).toBeVisible();
  await expect.poll(() => paused("#bgm-retry")).toBe(false);
  await expect.poll(() => paused("#bgm")).toBe(true);

  await page.locator("#result #back-title").click();
  await expect(page.locator("#scene-wipe")).not.toHaveClass(/active/);
  await expect.poll(() => paused("#bgm-title")).toBe(false);
  await expect.poll(() => paused("#bgm-retry")).toBe(true);
});
