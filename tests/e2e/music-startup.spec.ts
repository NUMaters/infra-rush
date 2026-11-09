import { expect, test } from "@playwright/test";
import type { Route } from "@playwright/test";

test("title audio preloads before the game bundle runs", async ({ page }) => {
  await page.route("**/assets/index-*.js", (route) =>
    route.fulfill({ contentType: "text/javascript", body: "" }),
  );
  await page.goto("/");
  const audio = page.locator("#bgm-title");
  await expect(audio).toHaveCount(1);
  await expect
    .poll(() =>
      audio.evaluate((music: HTMLAudioElement) => music.readyState >= 2),
    )
    .toBe(true);
  expect(await audio.evaluate((music: HTMLAudioElement) => music.paused)).toBe(
    true,
  );
});

test("a first tap starts BGM while 3D model downloads are still waiting", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const contexts: AudioContext[] = [];
    Object.defineProperty(window, "testAudioContexts", { value: contexts });
    const NativeContext = window.AudioContext;
    window.AudioContext = class extends NativeContext {
      constructor(options?: AudioContextOptions) {
        super(options);
        contexts.push(this);
      }
    };
  });
  const pending: Route[] = [];
  await page.route("**/models/**", (route) => {
    pending.push(route);
  });
  await page.goto("/", { waitUntil: "commit" });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { testAudioContexts: AudioContext[] })
            .testAudioContexts.length,
      ),
    )
    .toBeGreaterThan(0);
  await expect.poll(() => pending.length).toBeGreaterThan(0);
  const before = Date.now();
  await page
    .locator("#loading")
    .click({ position: { x: 10, y: 10 }, force: true });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const contexts = (
            window as unknown as { testAudioContexts: AudioContext[] }
          ).testAudioContexts;
          const audio = document.querySelector<HTMLAudioElement>("#bgm-title")!;
          return (
            contexts[0].state === "running" &&
            !audio.paused &&
            audio.currentTime > 0.05
          );
        }),
      { timeout: 5000 },
    )
    .toBe(true);
  console.log(`BGM first-tap latency: ${Date.now() - before}ms`);
  await expect(page.locator("#bgm-title")).toHaveCount(1);
  await Promise.all(pending.map((route) => route.abort()));
});
