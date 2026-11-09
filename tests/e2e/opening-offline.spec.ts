// Run against scripts/serve-preview.py serving the production build, or Pages.
// Vite preview adds Vary: Origin and does not reproduce production cache headers.
import { expect, test } from "@playwright/test";

test("offline autoplay refusal keeps a cached animation or poster", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Cache-loss fault injection uses Chromium CDP",
  );
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "hardwareConcurrency", { value: 8 });
    Object.defineProperty(navigator, "deviceMemory", { value: 8 });
    const mode = sessionStorage.getItem("offline-opening-test-mode");
    Object.defineProperty(navigator, "connection", {
      value: { saveData: mode === "lite" },
    });
    const observed = { maxTime: 0 };
    Object.assign(window, { offlineOpeningObserved: observed });
    document.addEventListener(
      "timeupdate",
      (event) => {
        const video = event.target as HTMLVideoElement;
        if (video.id === "opening-video")
          observed.maxTime = Math.max(observed.maxTime, video.currentTime);
      },
      true,
    );
    if (mode) {
      const original = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        return this.id === "opening-video"
          ? Promise.reject(
              new DOMException("Simulated autoplay refusal", "NotAllowedError"),
            )
          : original.call(this);
      };
      const observer = new MutationObserver(() => {
        const video =
          document.querySelector<HTMLVideoElement>("#opening-video");
        if (!video) return;
        video.autoplay = false;
        video.removeAttribute("autoplay");
        observer.disconnect();
      });
      observer.observe(document, { childList: true, subtree: true });
    }
  });
  await page.goto("/?offline-opening-test", { waitUntil: "domcontentloaded" });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { offlineOpeningObserved: { maxTime: number } })
            .offlineOpeningObserved.maxTime,
      ),
    )
    .toBeGreaterThan(0.3);
  await expect(page.locator("#title")).toBeVisible({ timeout: 60000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  const cacheName = await page.evaluate(async () =>
    (await caches.keys()).find((name) => /^infra-rush-v\d+$/.test(name))!,
  );
  const mediaRoot = "media/opening-gemini-77f0d820-";
  const modelUrls = await page.evaluate(async () => {
    const manifest = (await fetch("./models/manifest.json").then((r) =>
      r.json(),
    )) as { asset: string }[];
    return [
      ...manifest.map(({ asset }) => `models/${asset}.glb`),
      ...["excavator", "dozer", "grader", "drill", "launcher"].map(
        (name) => `models/${name}-red.glb`,
      ),
    ].map((path) => new URL(path, location.href).href);
  });
  const missingModels = () =>
    page.evaluate(
      async ({ name, urls }) => {
        const keys = (await (await caches.open(name)).keys()).map((r) => r.url);
        return urls.filter((url) => !keys.includes(url));
      },
      { name: cacheName, urls: modelUrls },
    );
  await expect.poll(missingModels, { timeout: 60000 }).toEqual([]);
  const cached = (file: string) =>
    page.evaluate(
      async ({ name, file }) =>
        !!(await (
          await caches.open(name)
        ).match(new URL(file, location.href).href)),
      { name: cacheName, file },
    );
  await expect.poll(() => cached(`${mediaRoot}fallback-v2.webp`)).toBe(true);
  await expect.poll(() => cached(`${mediaRoot}low-power.webp`)).toBe(true);
  await expect.poll(() => cached(`${mediaRoot}hd-poster.webp`)).toBe(true);

  const restart = async (mode: string, ending: string, width: number) => {
    await page.evaluate(
      (value) => sessionStorage.setItem("offline-opening-test-mode", value),
      mode,
    );
    await page.reload({ waitUntil: "commit" });
    await expect(page.locator("#opening-video")).toHaveClass(
      /opening-video-fallback/,
    );
    await expect
      .poll(
        () =>
          page
            .locator("#opening-motion-fallback")
            .evaluate((image: HTMLImageElement) => ({
              file: image.src.split("/").at(-1),
              width: image.naturalWidth,
              complete: image.complete,
            })),
        { timeout: 30000 },
      )
      .toEqual({
        file: `opening-gemini-77f0d820-${ending}`,
        width,
        complete: true,
      });
    await expect(page.locator("#title")).toBeVisible({ timeout: 30000 });
  };
  await page.context().setOffline(true);
  await restart("normal", "fallback-v2.webp", 960);
  await restart("lite", "low-power.webp", 480);

  const cdp = await page.context().newCDPSession(page);
  const removeCached = async (files: string[]) => {
    await page.evaluate(
      async ({ name, files }) => {
        const cache = await caches.open(name);
        await Promise.all(
          files.map((file) => cache.delete(new URL(file, location.href).href)),
        );
      },
      { name: cacheName, files },
    );
    await cdp.send("Network.clearBrowserCache");
  };
  await removeCached([`${mediaRoot}fallback-v2.webp`]);
  await restart("normal", "low-power.webp", 480);
  await removeCached([`${mediaRoot}low-power.webp`]);
  await restart("normal", "hd-poster.webp", 1280);
  await cdp.detach();
});
