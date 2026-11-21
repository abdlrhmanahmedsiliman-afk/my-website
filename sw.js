const CACHE_NAME = 'kashf-v15';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/assets/icon.svg',
  '/css/tokens.css',
  '/css/base.css',
  '/css/components.css',
  '/css/pages.css',
  '/css/motion.css',
  '/css/print.css',
  '/js/i18n-ar1.js',
  '/js/i18n-ar2.js',
  '/js/i18n-ar3.js',
  '/js/i18n-en1.js',
  '/js/i18n-en2.js',
  '/js/i18n-en3.js',
  '/js/i18n.js',
  '/js/icons.js',
  '/js/logic.js',
  '/js/logic-utils.js',
  '/js/logic-store.js',
  '/js/logic-finance.js',
  '/js/store.js',
  '/js/store-crud.js',
  '/js/store-ops.js',
  '/js/db.js',
  '/js/bus.js',
  '/js/profiles.js',
  '/js/auth.js',
  '/vendor/supabase/supabase.js',
  '/js/supabase-auth.js',
  '/js/plan.js',
  '/js/templates.js',
  '/js/ui.js',
  '/js/ui-overlays.js',
  '/js/charts.js',
  '/js/router.js',
  '/vendor/gsap/gsap.min.js',
  '/vendor/gsap/ScrollTrigger.min.js',
  '/vendor/gsap/SplitText.min.js',
  '/js/search.js',
  '/js/motion.js',
  '/js/pages/dashboard.js',
  '/js/pages/invoices.js',
  '/js/pages/invoice-editor.js',
  '/js/pages/invoice-editor-view.js',
  '/js/pages/invoice-editor-actions.js',
  '/js/pages/quotes.js',
  '/js/pages/clients.js',
  '/js/pages/expenses.js',
  '/js/pages/inventory-view.js',
  '/js/pages/inventory.js',
  '/js/pages/inventory-actions.js',
  '/js/pages/employees.js',
  '/js/pages/employees-actions.js',
  '/js/pages/advisor.js',
  '/js/pages/products.js',
  '/js/pages/pos.js',
  '/js/pages/budget.js',
  '/js/agent-governance.js',
  '/js/agent.js',
  '/js/pages/analysis.js',
  '/js/pages/stocktake.js',
  '/js/pages/reports-view.js',
  '/js/pages/reports.js',
  '/js/pages/settings-view.js',
  '/js/pages/settings.js',
  '/js/intro.js',
  '/js/onboarding.js',
  '/js/app.js',
  '/js/app-shell.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Only handle same-origin requests
  if (url.origin !== location.origin) {
    return;
  }
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Never cache server APIs, OAuth callbacks, or crawler metadata
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/callback') ||
    url.pathname === '/healthz' ||
    url.pathname === '/robots.txt' ||
    url.pathname === '/sitemap.xml'
  ) {
    return;
  }
  
  // Navigation: network-first so app fixes always reach the user,
  // with the cached shell as an offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request, { ignoreSearch: true }).then((cached) => cached || caches.match('/index.html', { ignoreSearch: true })))
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: true })
      .then((cached) => {
        if (cached) {
          // Return cached version and update in background
          event.waitUntil(
            fetch(request)
              .then((response) => {
                if (response.ok) {
                  caches.open(CACHE_NAME).then((cache) => cache.put(request, response));
                }
              })
              .catch(() => {})
          );
          return cached;
        }
        
        // Not in cache, fetch from network
        return fetch(request)
          .then((response) => {
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
            }
            return response;
          })
          .catch(() => {
            // Offline fallback for navigation requests
            if (request.mode === 'navigate') {
              return caches.match('/index.html', { ignoreSearch: true });
            }
            throw new Error('Offline');
          });
      })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});