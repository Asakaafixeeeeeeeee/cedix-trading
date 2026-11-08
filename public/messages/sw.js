/* Messages app service worker — scope /messages/.
 * Handles Web Push: shows the OS notification banner with the green Messages
 * icon and opens the app when tapped. No response caching (always fresh). */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = { title: 'CediX Trading', body: 'You have a new message.', url: '/messages' };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    /* keep defaults */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/messages/icon-192.png',
      badge: '/messages/icon-192.png',
      tag: 'cedix-messages',
      data: { url: data.url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/messages';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes('/messages') && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
