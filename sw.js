// Service Worker optimizado para iOS (Safari PWA) y Android
self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. NUNCA interceptar peticiones externas (Tailwind CDN, Google Fonts, WhatsApp)
    // Esto evita el bloqueo de redirecciones 302 en Safari iOS modo App.
    if (url.origin !== self.location.origin) {
        return;
    }

    // 2. NUNCA interceptar la API ni métodos distintos a GET
    if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) {
        return;
    }

    // 3. Para archivos propios, dejar pasar directo a la red (siempre actualizado)
    event.respondWith(fetch(event.request));
});
