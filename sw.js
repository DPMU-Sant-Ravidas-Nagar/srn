// sw.js - Complete Service Worker for offline support
const CACHE_NAME = 'trackmaster-v1';
const API_CACHE = 'api-cache-v1';
const STATIC_CACHE = 'static-cache-v1';

// Resources to cache immediately
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/login.html',
  '/newactivity.html',
  '/style.css',
  '/api.js',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  'https://fonts.googleapis.com/icon?family=Material+Icons+Round',
  'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2'
];

// Install event - precache static assets
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Caching static assets...');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== STATIC_CACHE && name !== API_CACHE)
          .map(name => {
            console.log('Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Network-first strategy for API calls
async function networkFirst(request) {
  try {
    // Try network first
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      // Clone response because it can only be used once
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('Network failed, trying cache...', error);
    
    // Fallback to cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If no cache, return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }
    
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Cache-first strategy for static assets
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('Failed to fetch:', request.url);
    return new Response('Offline', { status: 503 });
  }
}

// Stale-while-revalidate strategy for dynamic content
async function staleWhileRevalidate(request) {
  const cache = await caches.open(API_CACHE);
  
  // Try to get from cache
  const cachedResponse = await cache.match(request);
  
  // Fetch in background to update cache
  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(error => console.log('Background sync failed:', error));
  
  // Return cached response immediately if available
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Otherwise wait for network
  return fetchPromise;
}

// Fetch event with strategy selection
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // API calls - network first with cache fallback
  if (url.hostname.includes('script.google.com')) {
    event.respondWith(networkFirst(event.request));
  } 
  // Static assets - cache first
  else if (url.pathname.match(/\.(css|js|html|json|png|jpg|jpeg|gif|svg|ico)$/)) {
    event.respondWith(cacheFirst(event.request));
  }
  // HTML navigation - stale while revalidate
  else if (event.request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(event.request));
  }
  // Default - network first
  else {
    event.respondWith(networkFirst(event.request));
  }
});

// Background sync for offline activities
self.addEventListener('sync', event => {
  if (event.tag === 'sync-activities') {
    console.log('Background sync triggered');
    event.waitUntil(syncActivities());
  }
});

async function syncActivities() {
  try {
    // Get all clients
    const clients = await self.clients.matchAll();
    
    // Notify all clients to sync
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_ACTIVITIES',
        timestamp: Date.now()
      });
    });
    
    console.log('Sync completed');
  } catch (error) {
    console.error('Sync failed:', error);
  }
}

// Handle messages from clients
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Push notifications (if needed)
self.addEventListener('push', event => {
  const options = {
    body: event.data.text(),
    icon: '/icon.png',
    badge: '/badge.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      { action: 'explore', title: 'View' },
      { action: 'close', title: 'Close' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('TrackMaster', options)
  );
});
