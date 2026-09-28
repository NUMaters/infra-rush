import { expect, test } from "@playwright/test";

test("opening plays the video before the title appears", async ({ page }) => {
  await page.addInitScript(() => {
    const opening = { maxTime: 0, src: "" };
    Object.assign(window, { openingSeen: opening });
    document.addEventListener("DOMContentLoaded", () => {
      const video = document.querySelector<HTMLVideoElement>("#opening-video");
      video?.addEventListener("timeupdate", () => {
        opening.maxTime = Math.max(opening.maxTime, video.currentTime);
        opening.src = video.currentSrc;
      });
    });
  });
  await page.goto("/?qa", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#opening-video")).toHaveAttribute("autoplay", "");
  const source =
    (page.viewportSize()?.width ?? 0) <= 700 ? "-lite.mp4" : "-hd.mp4";
  await expect
    .poll(() =>
      page.evaluate((expected) => {
        const seen = (
          window as Window & { openingSeen?: { maxTime: number; src: string } }
        ).openingSeen;
        return seen?.src.includes(expected) ? seen.maxTime : 0;
      }, source),
    )
    .toBeGreaterThan(0.3);
  await expect(page.locator("#title")).toBeVisible({ timeout: 30000 });
});

test("blocked autoplay uses a moving image without asking for a tap", async ({
  page,
}) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = function () {
      if (this.id === "opening-video")
        return Promise.reject(new DOMException("blocked", "NotAllowedError"));
      return Promise.resolve();
    };
  });
  await page.route("**/?qa-opening", async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(/\s+autoplay\s*/, "\n");
    await route.fulfill({ response, body });
  });
  await page.goto("/?qa-opening", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#opening-video")).toHaveClass(
    /opening-video-fallback/,
  );
  await expect(page.locator("#opening-motion-fallback")).toHaveAttribute(
    "src",
    /opening-gemini-77f0d820-low-power\.webp$/,
  );
  const firstFrame = await page
    .locator("#opening-motion-fallback")
    .screenshot();
  await page.waitForTimeout(700);
  const nextFrame = await page.locator("#opening-motion-fallback").screenshot();
  expect(firstFrame.equals(nextFrame)).toBe(false);
  await expect(page.locator("#opening-play")).toHaveCount(0);
  await expect(page.locator("#title")).toBeVisible({ timeout: 30000 });
});
