// Sprint 4 — app-shell service worker so the counter tablet still loads the
// board when wifi drops. Session-start POSTs are queued separately in
// localStorage (see lib/offlineQueue.ts); this SW only caches GET assets.

const CACHE = "kh-shell-v1";
const SHELL = ["/", "/sessions", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never cache mutations

  const url = new URL(req.url);
  // Don't cache API reads — they must be fresh when online.
  if (url.pathname.startsWith("/api/")) return;

  // Navigations & static GETs: network-first, fall back to cache when offline.
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((m) => m || caches.match("/"))),
  );
});
