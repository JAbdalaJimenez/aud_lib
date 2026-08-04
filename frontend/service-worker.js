const CACHE_NAME = 'audiolib-cache-v1';

// Recursos estáticos que se van a cachear para el funcionamiento offline básico
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/reader.html',
  '/css/styles.css',
  '/js/library.js',
  '/js/reader.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/favicon-32.png',
  '/icons/apple-touch-icon-180.png'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Cacheando recursos estáticos');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Forzar que el SW se active inmediatamente
  self.skipWaiting();
});

// Activación del Service Worker y limpieza de cachés antiguos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Borrando caché antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Intercepción de peticiones de red
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Peticiones a la API del backend (o archivos subidos) -> Network First
  // También evitamos cachear peticiones POST/PATCH/DELETE (solo GET se cachea bien)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) {
    if (request.method !== 'GET') {
      // Dejar pasar POST, PATCH, DELETE directo a la red (no cacheables por defecto)
      return;
    }

    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Si la respuesta es buena, la guardamos en el caché dinámico
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          // Si falla la red (offline), intentamos sacar la info del caché
          return caches.match(request);
        })
    );
    return;
  }

  // 2. Peticiones de recursos estáticos -> Cache First
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Si está en el caché, lo devolvemos inmediatamente
      if (cachedResponse) {
        return cachedResponse;
      }

      // Si no, vamos a la red
      return fetch(request).then((networkResponse) => {
        // Solo cacheamos respuestas válidas y peticiones de nuestra URL origen
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        // Cacheamos para la próxima
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });

        return networkResponse;
      }).catch(err => {
        console.error('[Service Worker] Fallo en la red y no hay caché para:', request.url);
      });
    })
  );
});
