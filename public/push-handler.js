/* Push Notification Handler
 * Imported into the generated Workbox service worker via vite.config.ts importScripts
 */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: '풋살 매니저', body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(data.title ?? '풋살 매니저', {
      body: data.body ?? '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      tag: data.matchId ?? 'match-notification',
      renotify: true,
      data: { url: data.url ?? '/?tab=schedule' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? '/?tab=schedule';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
