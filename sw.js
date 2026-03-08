const CACHE_NAME = 'trackmaster-v2';
const API_CACHE = 'api-cache-v1';
const STATIC_CACHE = 'static-cache-v1';

const STATIC_ASSETS = [
  '/', '/index.html', '/login.html', '/newactivity.html', '/style.css', '/api.js', '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  'https://fonts.googleapis.com/icon?family=Material+Icons+Round',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(STATIC_CACHE).then(c => c.addAll(STATIC_ASSETS))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== STATIC_CACHE && k !== API_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.hostname.includes('script.google.com')) {
    e.respondWith(fetch(e.request).then(r => { const clone = r.clone(); caches.open(API_CACHE).then(c => c.put(e.request, clone)); return r; }).catch(() => caches.match(e.request)));
  } else {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(r => { const clone = r.clone(); caches.open(STATIC_CACHE).then(c => c.put(e.request, clone)); return r; })));
  }
});
