import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      raf((time) => window.setTimeout(() => callback(time), 100));
  });
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
  await trigger.click();
  await expect(
    page.getByText("動画を読み込んでいます…", { exact: true }),
  ).toHaveCount(0);
  await expect
    .poll(
      () =>
        page
          .locator("#intro-movie-video")
          .evaluate(
            (video: HTMLVideoElement) =>
              !video.paused &&
              video.currentTime > 0.2 &&
              video.videoWidth > 0 &&
              video.getVideoPlaybackQuality().totalVideoFrames > 0,
          ),
      { timeout: 30000 },
    )
    .toBe(true);
  expect(
    await page.evaluate(async () => {
      const video =
        document.querySelector<HTMLVideoElement>("#intro-movie-video")!;
      const poster = new Image();
      poster.src = video.poster;
      await poster.decode();
      return poster.naturalWidth;
    }),
  ).toBeGreaterThan(0);
  await trigger.evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("video")).toHaveCount(1);
  await expect(page.locator("#intro-movie-close")).toBeFocused();
  const bounds = await dialog.locator(".intro-movie-panel").boundingBox();
  const viewport = page.viewportSize()!;
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds!.width).toBeGreaterThan(viewport.width * 0.8);
  await expect(page.locator("#intro-movie-close")).toBeInViewport();
  await page.locator("#intro-movie-close").dblclick();
  await expect(dialog.locator("video")).toHaveCount(0);
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.press("Enter");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("video")).toHaveCount(1);
  await dialog.locator("video").focus();
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
    "VIDEO",
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

test("a blocked autoplay offers a working play button", async ({ page }) => {
  await page.evaluate(() => {
    const play = HTMLMediaElement.prototype.play;
    let rejectOnce = true;
    HTMLMediaElement.prototype.play = function () {
      if (this.id === "intro-movie-video" && rejectOnce) {
        rejectOnce = false;
        return Promise.reject(
          new DOMException("Playback blocked", "NotAllowedError"),
        );
      }
      return play.call(this);
    };
  });
  await page.locator("#title-movie-open").click();
  await expect(page.locator("#intro-movie-play")).toBeVisible();
  await page.locator("#intro-movie-play").click();
  await expect
    .poll(() =>
      page
        .locator("#intro-movie-video")
        .evaluate(
          (video: HTMLVideoElement) => !video.paused && video.currentTime > 0.2,
        ),
    )
    .toBe(true);
  await expect(page.locator(".intro-movie-feedback")).toBeHidden();
  await page.locator("#intro-movie-close").click();
  await expect(page.locator("#intro-movie")).not.toBeVisible();
});

test("a failed download stays closable and can retry", async ({ page }) => {
  await page.route("**/media/intro-v1.mp4", (route) => route.abort());
  await page.locator("#title-movie-open").click();
  await expect(page.locator("#intro-movie-play")).toHaveText(
    "もう一度読み込む",
  );
  await page.unroute("**/media/intro-v1.mp4");
  await page.locator("#intro-movie-play").click();
  await expect
    .poll(() =>
      page
        .locator("#intro-movie-video")
        .evaluate(
          (video: HTMLVideoElement) => !video.paused && video.currentTime > 0.2,
        ),
    )
    .toBe(true);
  await page.locator("#intro-movie-close").click();
  await expect(page.locator("#intro-movie")).not.toBeVisible();
});
