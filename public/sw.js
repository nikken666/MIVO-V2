// MIVO service worker. Kept small on purpose:
// - pages always come from the network (prices, stock and orders change), with
//   a friendly offline page when there is no connection;
// - built JS/CSS (/_next/static, file names change on every deploy) are cached.
const STATIC = "mivo-static-v1";
const OFFLINE = "mivo-offline-v1";
const OFFLINE_URL = "/offline.html";
const MAX_STATIC = 250;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(OFFLINE).then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC && k !== OFFLINE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_STATIC; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) {
          cache.put(request, response.clone());
          trim(cache);
        }
        return response;
      })
    );
  }
});
