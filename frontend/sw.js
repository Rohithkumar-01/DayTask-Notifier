// DayGrid Service Worker
// Handles background push notifications on Android lockscreen

self.addEventListener('install', e => {
  self.skipWaiting();
  console.log('[SW] Installed');
});

self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
  console.log('[SW] Activated');
});

// ── PUSH EVENT: fires when server sends a notification ──────────────
self.addEventListener('push', e => {
  console.log('[SW] Push received');

  let data = {
    title: '⏰ DayGrid Reminder',
    body: 'You have pending tasks!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'daygrid-reminder',
    renotify: true,
    data: { url: '/' }
  };

  try {
    if (e.data) data = { ...data, ...e.data.json() };
  } catch (err) {
    if (e.data) data.body = e.data.text();
  }

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icon-192.png',
      badge: data.badge || '/icon-192.png',
      tag: data.tag || 'daygrid',
      renotify: data.renotify || true,
      vibrate: [200, 100, 200, 100, 200],
      actions: [
        { action: 'open', title: '📋 Open App' },
        { action: 'dismiss', title: 'Dismiss' }
      ],
      data: data.data || { url: '/' }
    })
  );
});

// ── NOTIFICATION CLICK: open or focus the app ──────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();

  if (e.action === 'dismiss') return;

  const urlToOpen = e.notification.data?.url || '/';

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // If app is already open, focus it
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// ── FETCH: basic cache for offline support ──────────────────────────
self.addEventListener('fetch', e => {
  // Let all requests pass through (no aggressive caching)
  e.respondWith(fetch(e.request).catch(() => {
    // If offline and navigating, show app shell
    if (e.request.mode === 'navigate') {
      return caches.match('/');
    }
  }));
});
