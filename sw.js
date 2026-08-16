const CACHE_NAME = "meteo-cache-v2";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener("fetch", (e) => {
  // Stratégie : Essayer le réseau en premier, sinon utiliser le cache
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Si la requête réussit, on clone la réponse pour la mettre en cache
        if (response && response.status === 200 && response.type === 'basic' || response.type === 'cors') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Si le réseau échoue (hors-ligne), on cherche dans le cache
        return caches.match(e.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return new Response(JSON.stringify({ error: "Hors ligne" }), {
            headers: { "Content-Type": "application/json" }
          });
        });
      })
  );
});

self.addEventListener('push', function(event) {
    const data = event.data ? event.data.json() : {};
    const title = data.title || "Alerte Météo Ultra Pro";
    const options = {
        body: data.body || "Changement brutal de temps détecté.",
        icon: '/assets/icon-192.png',
        badge: '/assets/badge.png'
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});