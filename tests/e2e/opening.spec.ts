import { expect, test } from "@playwright/test";

test("opening plays the video before the title appears", async ({ page }) => {
  await page.goto("/?qa", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#opening-video")).toHaveAttribute("autoplay", "");
  const source =
    (page.viewportSize()?.width ?? 0) <= 700 ? "-lite.mp4" : "-hd.mp4";
  await expect
    .poll(() =>
      page
        .locator("#opening-video")
        .evaluate(
          (video, expected) =>
            (video as HTMLVideoElement).currentSrc.includes(expected)
              ? (video as HTMLVideoElement).currentTime
              : 0,
          source,
        ),
    )
    .toBeGreaterThan(0.3);
  await expect(page.locator("#loading")).toBeVisible();
  await expect(page.locator("#opening-video")).toHaveClass(
    /opening-video-moving/,
  );
  await expect(page.locator("#title")).toBeVisible({ timeout: 30000 });
});

test("a blocked autoplay can be started with one tap", async ({ page }) => {
  await page.addInitScript(() => {
    const nativePlay = HTMLMediaElement.prototype.play;
    (window as Window & { allowOpening?: boolean }).allowOpening = false;
    HTMLMediaElement.prototype.play = function () {
      if (
        this.id === "opening-video" &&
        !(window as Window & { allowOpening?: boolean }).allowOpening
      )
        return Promise.reject(new DOMException("blocked", "NotAllowedError"));
      return nativePlay.call(this);
    };
  });
  await page.route("**/?qa-opening", async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(/\s+autoplay\s*/, "\n");
    await route.fulfill({ response, body });
  });
  await page.goto("/?qa-opening", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#opening-play")).toBeVisible();
  await page.evaluate(() => {
    (window as Window & { allowOpening?: boolean }).allowOpening = true;
  });
  await page.locator("#opening-play").click();
  await expect
    .poll(() =>
      page
        .locator("#opening-video")
        .evaluate((video) => (video as HTMLVideoElement).currentTime),
    )
    .toBeGreaterThan(0.3);
  await expect(page.locator("#opening-play")).toBeHidden();
});
