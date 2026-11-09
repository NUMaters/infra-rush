import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      raf((time) => window.setTimeout(() => callback(time), 100));
  });
  // Real Drive playback is checked separately; keep interaction tests independent
  // of the third-party player's network speed and cookie prompts.
  await page.route("https://drive.google.com/file/d/*/preview", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<button>動画を再生</button>",
    }),
  );
  await page.goto("/");
  await expect(page.locator("#title")).not.toHaveClass(/hidden/, {
    timeout: 60000,
  });
});

test("movie opens once, fits the viewport, closes and reopens with a fresh player", async ({
  page,
}) => {
  const trigger = page.locator("#title-movie-open");
  const dialog = page.getByRole("dialog", {
    name: "INFRA RUSH 紹介ムービー",
    exact: true,
  });
  await trigger.evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
    button.click();
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("iframe")).toHaveCount(1);
  await expect(page.locator("#intro-movie-close")).toBeFocused();
  const bounds = await dialog.locator(".intro-movie-panel").boundingBox();
  const viewport = page.viewportSize()!;
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds!.width).toBeGreaterThan(viewport.width * 0.8);
  await expect(page.locator("#intro-movie-close")).toBeInViewport();
  await page.locator("#intro-movie-close").dblclick();
  await expect(dialog.locator("iframe")).toHaveCount(0);
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.press("Enter");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("iframe")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await trigger.press("Space");
  await expect(dialog).toBeVisible();
  await dialog.click({ position: { x: 4, y: 4 } });
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await page.locator("#start").click();
  await expect(page.locator("#solo-menu")).not.toHaveClass(/hidden/);
});

test("keyboard stays in the modal and music resumes only when it was playing", async ({
  page,
}) => {
  const trigger = page.locator("#title-movie-open");
  const music = page.locator("#bgm-title");
  await page.locator(".edition").click({ force: true });
  await expect
    .poll(() => music.evaluate((el: HTMLAudioElement) => el.paused))
    .toBe(false);
  await trigger.click();
  await expect
    .poll(() => music.evaluate((el: HTMLAudioElement) => el.paused))
    .toBe(true);
  await page.keyboard.press("Shift+Tab");
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe(
    "IFRAME",
  );
  await page.locator("#intro-movie-close").click();
  await expect
    .poll(() => music.evaluate((el: HTMLAudioElement) => el.paused))
    .toBe(false);
  await page.locator("#title-sound").click();
  await expect(page.locator("#title-sound")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await trigger.click();
  await page.locator("#intro-movie-close").click();
  await expect(page.locator("#title-sound")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await music.evaluate((el: HTMLAudioElement) => el.pause());
  await trigger.click();
  await page.locator("#intro-movie-close").click();
  await expect
    .poll(() => music.evaluate((el: HTMLAudioElement) => el.paused))
    .toBe(true);
});
