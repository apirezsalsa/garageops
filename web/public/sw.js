const CACHE_NAME = 'garageops-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // El documento HTML (y cualquier navegación) nunca se sirve desde caché: siempre a red, para que
  // tras cada despliegue apunte a los assets con hash correctos y no se quede atascado en una versión vieja.
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(fetch(req));
    return;
  }

  // El resto de assets (JS/CSS con hash en el nombre, imágenes...) son inmutables una vez publicados:
  // cache-first está bien y acelera cargas repetidas.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && req.method === 'GET') {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return res;
      });
    })
  );
});
