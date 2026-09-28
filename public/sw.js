const CACHE = "infra-rush-v9";
const ROOT = new URL(self.registration.scope);
const OPENING_MOVIE = new URL("media/opening-gemini-77f0d820-hd.mp4", ROOT).href;
const OPENING_POSTER = new URL("media/opening-gemini-77f0d820-hd-poster.webp", ROOT).href;

async function openingRange(request) {
  const cached = await (await caches.open(CACHE)).match(OPENING_MOVIE);
  if (!cached) return fetch(request);
  const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (!match) return fetch(request);
  const bytes = await cached.arrayBuffer();
  const total = bytes.byteLength;
  const start = match[1] ? Number(match[1]) : Math.max(0, total - Number(match[2]));
  const end = match[2] && match[1] ? Math.min(Number(match[2]), total - 1) : total - 1;
  if (start > end || start >= total)
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
  return new Response(bytes.slice(start, end + 1), {
    status: 206,
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${total}`,
      "Content-Type": "video/mp4",
    },
  });
}

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
    OPENING_MOVIE,
    OPENING_POSTER,
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
      await Promise.all([
        cacheOne(cache, OPENING_MOVIE),
        cacheOne(cache, OPENING_POSTER),
      ]);
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
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "CACHE_GAME_ASSETS") event.waitUntil(cacheGameAssets());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== ROOT.origin) return;
  if (request.headers.has("range")) {
    if (new URL(request.url).pathname === new URL(OPENING_MOVIE).pathname)
      event.respondWith(openingRange(request));
    return;
  }
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
