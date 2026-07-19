// Sprint 4 — app-shell service worker so the counter tablet still loads the
// board when wifi drops. Deliberately minimal: it ONLY handles top-level page
// navigations (network-first, cache fallback). Everything else — Next.js static
// chunks, /api/* calls — passes straight through to the network untouched, so
// the SW can never serve a stale JS bundle or an empty response. Session-start
// POSTs are queued separately in localStorage (lib/offlineQueue.ts).

const CACHE = "kh-shell-v2";
const OFFLINE_URLS = ["/", "/sessions"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(OFFLINE_URLS)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only intercept top-level navigations. Let assets and APIs go to the network
  // normally (no respondWith) — this avoids any stale-cache or empty-response risk.
  if (req.mode !== "navigate") return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(async () => {
        // Offline: serve the cached page, or the cached board as a last resort.
        return (
          (await caches.match(req)) ||
          (await caches.match("/")) ||
          Response.error()
        );
      }),
  );
});
