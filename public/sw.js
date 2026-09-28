const CACHE = "infra-rush-v13";
const PREVIOUS_SHELL = `${CACHE}-previous-shell`;
const ROOT = new URL(self.registration.scope);
const OPENING_POSTER = new URL("media/opening-gemini-77f0d820-hd-poster.webp", ROOT).href;
const OPENING_ANIMATION = new URL("media/opening-gemini-77f0d820-fallback-v2.webp", ROOT).href;

async function cacheOne(cache, url) {
  if (await cache.match(url)) return;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (response.ok) await cache.put(url, response);
  } catch {
    // Optional assets do not delay installation indefinitely.
  }
}

async function cacheGameAssets() {
  const cache = await caches.open(CACHE);
  const manifest = await fetch(new URL("models/manifest.json", ROOT)).then((r) => r.json());
  const assets = [
    ...manifest.map(({ asset }) => new URL(`models/${asset}.glb`, ROOT).href),
    ...["excavator", "dozer", "grader", "drill", "launcher"].map((name) =>
      new URL(`models/${name}-red.glb`, ROOT).href),
    ...["soil", "stone", "iron"].map((name) => new URL(`ui/resources/${name}.png`, ROOT).href),
    ...["stone-bridge", "steel-bridge", "excavator", "dozer", "launcher", "grader", "soil", "stone-resource"].map((name) => new URL(`ui/trivia/${name}.png`, ROOT).href),
    ...["infra-rush-title", "infra-rush-loop", "infra-rush-victory", "infra-rush-retry"].map((name) => new URL(`audio/${name}.mp3`, ROOT).href),
    OPENING_POSTER,
    OPENING_ANIMATION,
  ];
  for (let i = 0; i < assets.length; i += 4)
    await Promise.all(assets.slice(i, i + 4).map((url) => cacheOne(cache, url)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await cache.addAll([
        ROOT.href,
        new URL("manifest.webmanifest", ROOT).href,
        new URL("icons/icon-192.png", ROOT).href,
        new URL("icons/icon-512.png", ROOT).href,
      ]);
      await cacheOne(cache, OPENING_POSTER);
      await cacheOne(cache, OPENING_ANIMATION);
      const html = await (await cache.match(ROOT.href)).text();
      const entrypoints = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(
        ([, path]) => new URL(path, ROOT).href,
      );
      const vendor = [
        "three.module.js", "three.core.js", "addons/loaders/GLTFLoader.js",
        "addons/utils/BufferGeometryUtils.js", "addons/controls/OrbitControls.js",
      ].map((name) => new URL(`vendor/${name}`, ROOT).href);
      await Promise.all([...entrypoints, ...vendor].map((url) => cacheOne(cache, url)));
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const previous = keys
        .filter((key) => /^infra-rush-v\d+$/.test(key) && key !== CACHE)
        .sort((a, b) => Number(b.match(/\d+$/)[0]) - Number(a.match(/\d+$/)[0]))[0];
      if (previous) {
        // A page opened just before activation may still reference its old
        // hashed JS/CSS. Keep only that shell until the next SW update.
        const oldCache = await caches.open(previous);
        const shellCache = await caches.open(PREVIOUS_SHELL);
        const requests = await oldCache.keys();
        await Promise.all(requests.filter((request) => {
          const path = new URL(request.url).pathname;
          return path.startsWith(new URL("assets/", ROOT).pathname) && /\.(?:js|css)$/.test(path);
        }).map(async (request) => {
          const response = await oldCache.match(request);
          if (response) await shellCache.put(request, response);
        }));
      }
      await Promise.all(keys.filter((key) => key !== CACHE && key !== PREVIOUS_SHELL)
        .map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "CACHE_GAME_ASSETS") event.waitUntil(cacheGameAssets());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== ROOT.origin) return;
  // Let the browser stream and seek video directly. Buffering whole MP4 files
  // inside the worker can stall low-memory devices while models are loading.
  if (url.pathname.startsWith(new URL("media/opening-", ROOT).pathname) &&
      url.pathname.endsWith(".mp4")) return;
  if (request.headers.has("range")) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.status === 200) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
        }
        return response;
      })
      .catch(async () =>
        (await caches.match(request)) ??
        (request.mode === "navigate" ? await caches.match(ROOT.href) : null) ??
        Response.error(),
      ),
  );
});
