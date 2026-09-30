import { expect, test } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

test("title artwork stays above usable menus on short and narrow screens", async ({
  page,
}) => {
  // Keep software WebGL rendering from starving browser layout/action checks.
  await page.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      raf((time) => window.setTimeout(() => callback(time), 100));
  });
  await page.goto("/");
  await expect(page.locator("#title")).not.toHaveClass(/hidden/, {
    timeout: 60000,
  });
  for (const size of [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 1024, height: 600 },
    { width: 800, height: 450 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    console.log(`Checking title at ${size.width}x${size.height}`);
    await page.setViewportSize(size);
    for (const solo of [false, true]) {
      if (solo) await page.locator("#start").click();
      const bounds = await page.evaluate(() => {
        const rect = (selector: string) => {
          const r = document.querySelector(selector)!.getBoundingClientRect();
          return {
            top: r.top,
            bottom: r.bottom,
            left: r.left,
            right: r.right,
            width: r.width,
          };
        };
        return {
          logo: rect(".logo"),
          tagline: rect(".title-tagline-art"),
          menu: rect(".start-card"),
        };
      });
      expect(bounds.tagline.width).toBeGreaterThan(0);
      expect(bounds.logo.bottom).toBeLessThan(bounds.menu.top);
      expect(bounds.tagline.bottom + 8).toBeLessThanOrEqual(bounds.menu.top);
      expect(bounds.menu.left).toBeGreaterThanOrEqual(0);
      expect(bounds.menu.right).toBeLessThanOrEqual(size.width);
      if (!solo && size.width === 1024) {
        await page.screenshot({ path: "test-results/title-1024x600.png" });
      }
      const button = page.locator(solo ? "#cpu-start" : "#start");
      await button.scrollIntoViewIfNeeded();
      await expect(button).toBeInViewport();
      if (solo) await page.locator("#solo-back").click();
    }
  }
});
