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
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of clientList) {
        if (!client.url.includes(self.location.origin)) continue;
        // 이미 열려있는 탭이면 그 탭을 우선 사용 (새 창을 또 띄우지 않음)
        try {
          // client.navigate는 새 WindowClient를 resolve할 수 있음 — 그걸 focus
          const navigated = await client.navigate(targetUrl);
          await (navigated ?? client).focus();
        } catch {
          // 일부 브라우저는 cross-origin이거나 cross-tab navigate를 거부함 → focus만
          if ('focus' in client) await client.focus();
        }
        return;
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});
