// Minimal app-shell cache so the PWA launches instantly and offline (it just can't connect).
const V = "tether-v1", FILES = ["./", "index.html", "app.js", "gestures.js", "core/auth.js", "core/input.js", "core/perf.js"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(V).then((c) => c.addAll(FILES))));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k))))));
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).pathname.endsWith("/ws")) return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));   // network first, cache fallback
});
