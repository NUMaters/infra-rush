const CACHE = "infra-rush-v1";
const ROOT = new URL(self.registration.scope);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      const shell = [
        ROOT.href,
        new URL("manifest.webmanifest", ROOT).href,
        new URL("icons/icon-192.png", ROOT).href,
        new URL("icons/icon-512.png", ROOT).href,
      ];
      await cache.addAll(shell);
      const html = await (await cache.match(ROOT.href)).text();
      const entrypoints = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(
        ([, path]) => new URL(path, ROOT).href,
      );
      const models = await fetch(new URL("models/manifest.json", ROOT)).then((r) => r.json());
      const assets = [
        ...entrypoints,
        ...models.map(({ asset }) => new URL(`models/${asset}.glb`, ROOT).href),
        ...["soil", "stone", "iron"].map((name) => new URL(`ui/resources/${name}.png`, ROOT).href),
        ...["stone-bridge", "steel-bridge", "excavator", "dozer", "launcher", "grader", "soil", "stone-resource"].map((name) => new URL(`ui/trivia/${name}.png`, ROOT).href),
        ...["infra-rush-title", "infra-rush-loop", "infra-rush-victory", "infra-rush-retry"].map((name) => new URL(`audio/${name}.mp3`, ROOT).href),
        ...["three.module.js", "three.core.js", "addons/loaders/GLTFLoader.js", "addons/utils/BufferGeometryUtils.js", "addons/controls/OrbitControls.js"].map((name) => new URL(`vendor/${name}`, ROOT).href),
      ];
      await Promise.all(
        assets.map(async (url) => {
          const response = await fetch(url).catch(() => null);
          if (response?.ok) await cache.put(url, response);
        }),
      );
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

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== ROOT.origin) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
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
