/* Stack service worker: app shell works offline; seed.json and pages refresh from the network when available. */
const CACHE = "stack-v30";
const SHELL = ["./", "index.html", "local-db.js", "cloud.js", "firebase-config.js", "vendor/firebase-app-compat.js", "vendor/firebase-auth-compat.js", "vendor/firebase-firestore-compat.js", "seed.json", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // fonts and Spotify go straight to the network
  e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; }).catch(() => caches.match(req).then(r => r || caches.match("index.html"))));
});
