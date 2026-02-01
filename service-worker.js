// Service Worker pour PWA
const CACHE_NAME = 'lotato-pro-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/owner.html',
  '/style.css',
  '/script.js',
  '/owner.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});