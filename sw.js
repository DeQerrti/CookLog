const CACHE_NAME = 'cooklog-v4';
const STATIC_ASSETS = [
  '/css/style.css',
  '/css/admin.css',
  '/js/api.js',
  '/js/recipes.js',
  '/js/modal.js',
  '/js/admin.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=Inter:wght@400;500&display=swap'
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS.filter(url => !url.startsWith('https://fonts')));
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for static, network-first for API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and our own API calls (always fresh)
  if (event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;

  // Never intercept page navigations (typing a URL, clicking a link, etc).
  // Cloudflare Pages can 308-redirect e.g. "/admin.html" -> "/admin", and
  // Chrome refuses to respondWith() a Response whose `redirected` flag is
  // true for navigation-mode requests ("a redirected response was used for
  // a request whose redirect mode is not 'follow'"). Letting the browser
  // handle navigations natively avoids that failure mode entirely; we only
  // add value by caching the static sub-resources below.
  if (event.request.mode === 'navigate') return;

  // Fonts: cache-first
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => stripRedirectFlag(response)).then((response) => {
            cache.put(event.request, response.clone());
            return response;
          });
        });
      })
    );
    return;
  }

  // Static assets: cache-first, fallback to network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => stripRedirectFlag(response)).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => undefined);
    })
  );
});

// Chrome refuses to respondWith() a Response whose `redirected` flag is true
// for navigation requests (throws "a redirected response was used for a
// request whose redirect mode is not 'follow'"). Cloudflare Pages can issue
// an internal redirect (e.g. HTTPS/host canonicalisation) even for same-URL
// requests, so we defensively rebuild the Response to strip that flag.
function stripRedirectFlag(response) {
  if (!response.redirected) return response;
  return response.blob().then((body) => new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  }));
}
