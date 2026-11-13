const CACHE = "shahezo-shell-v6";
const PRECACHE = ["/", "/offline.html", "/manifest.webmanifest", "/chef-hat.png", "/notif-icon-v5.png", "/notif-badge-v5.png"];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE).catch(() => {})));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html") || caches.match("/"))
    );
  }
});

self.addEventListener("push", event => {
  if (!event.data) return;
  event.waitUntil((async () => {
    try {
      const payload = event.data.json();
      const title = typeof payload.title === "string" ? payload.title.slice(0, 110) : "🥙 بوفية شهيزو – SHAHEZO";
      const body = typeof payload.body === "string" ? payload.body.slice(0, 340) : "تم تحديث حالة طلبك من بوفية شهيزو";
      const requestedUrl = typeof payload.url === "string" ? payload.url : "/orders";
      const url = requestedUrl.startsWith("/") && !requestedUrl.startsWith("//") ? requestedUrl : "/orders";
      const tag = typeof payload.tag === "string" ? payload.tag.slice(0, 100) : "shahezo-order-update";
      const isAdminUrl = url.startsWith("/admin");
      await self.registration.showNotification(title, {
        body,
        icon: "/notif-icon-v5.png",
        badge: "/notif-badge-v5.png",
        tag,
        renotify: true,
        requireInteraction: isAdminUrl,
        vibrate: isAdminUrl ? [240, 90, 240, 90, 320] : [180, 80, 200],
        actions: [
          { action: "open_order", title: isAdminUrl ? "📋 فتح الطلب وتجهيزه" : "🛵 تتبع حالة الطلب" }
        ],
        data: { url },
        dir: "rtl",
        lang: "ar",
      });
    } catch (error) {
      console.warn("[PWA] Push error:", error);
    }
  })());
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const requestedUrl = typeof event.notification.data?.url === "string" ? event.notification.data.url : "/orders";
  const url = requestedUrl.startsWith("/") && !requestedUrl.startsWith("//") ? new URL(requestedUrl, self.location.origin) : new URL("/orders", self.location.origin);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (!client.url.startsWith(self.location.origin)) continue;
      await client.navigate(url.href);
      await client.focus();
      return;
    }
    await self.clients.openWindow(url.href);
  })());
});
