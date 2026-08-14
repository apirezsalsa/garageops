const CACHE_NAME = 'garageops-v2';

// Firebase Cloud Messaging para notificaciones push en segundo plano. Se integra en este mismo
// service worker (en vez de registrar uno nuevo aparte) porque dos SW con scope raíz "/" se pisarían
// entre sí y solo controlaría el último registrado, rompiendo el caché de la PWA de arriba.
importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBFI60elQ9espDdquI9tnSipbNFN_lfsxI",
  authDomain: "garageops-6511f.firebaseapp.com",
  projectId: "garageops-6511f",
  storageBucket: "garageops-6511f.firebasestorage.app",
  messagingSenderId: "1077063710094",
  appId: "1:1077063710094:web:911bc7f65d9fe43159e0df"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'MyGarageOps';
  self.registration.showNotification(title, {
    body: payload.notification?.body || '',
    icon: '/logo.png',
    badge: '/logo.png',
  });
});

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
