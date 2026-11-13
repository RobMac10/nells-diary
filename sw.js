/* Cache-first service worker so the diary can be used offline after one visit. No tracking. */
const CACHE = "nells-diary-v2";

function assetUrl(path) {
  return new URL(path, self.registration.scope).href;
}

const ASSETS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "assets/style.css",
  "assets/app.js",
  "assets/data.js",
  "assets/chapel-school.jpg",
  "assets/chapel-school-large.jpg",
  "assets/smudge-ink.png",
  "assets/blot-1.png",
  "assets/blot-2.png",
  "assets/blot-3.png",
  "assets/fonts/CedarvilleCursive-Regular.ttf",
  "assets/fonts/Italianno-Regular.ttf",
  "assets/fonts/Kalam-Regular.ttf"
].map(assetUrl);

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  // Only handle requests under this app (e.g. /nells-diary/), never the whole origin.
  const scope = new URL("./", self.registration.scope);
  if (!url.pathname.startsWith(scope.pathname)) return;
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (res) {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
        }
        return res;
      }).catch(function () {
        if (event.request.mode === "navigate") return caches.match(assetUrl("index.html"));
        return caches.match(event.request);
      });
    })
  );
});
