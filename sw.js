self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener("fetch", (e) => {
  // Force la récupération sur le réseau sans passer par le cache HTTP
  e.respondWith(
    fetch(e.request, { cache: "no-store" }).catch(() => new Response("Hors ligne"))
  );
});