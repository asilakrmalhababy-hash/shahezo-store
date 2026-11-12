const CACHE = "shahezo-shell-v1";
const PRECACHE = ["/", "/offline.html", "/manifest.webmanifest", "/app-icon-180-v4.png", "/app-icon-192-v4.png", "/app-icon-512-v4.png", "/notif-icon-v3.png", "/notif-badge-v3.png", /*__ASSET_LIST__*/];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE).catch(() => {})));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
      .then(async () => {
        const clients = await self.clients.matchAll({ type: "window" });
        for (const client of clients) {
          try { await client.navigate(client.url); } catch {}
        }
      })
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(caches.open(CACHE).then(async cache => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          cache.put("/", response.clone());
          return response;
        }
      } catch {}
      return (await cache.match("/")) || (await cache.match("/offline.html"));
    }));
    return;
  }

  if (url.pathname.startsWith("/api/fast-img/") || url.pathname.includes("/assets/") || url.pathname.endsWith(".png") || url.pathname.endsWith(".webp") || url.pathname.endsWith(".webmanifest")) {
    event.respondWith(caches.open(CACHE).then(async cache => {
      const cached = await cache.match(request, { ignoreSearch: !url.pathname.startsWith("/api/fast-img/") });
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      } catch {
        return new Response("", { status: 504 });
      }
    }));
    return;
  }
});

self.addEventListener("push", event => {
  if (!event.data) return;
  event.waitUntil((async () => {
    try {
      const payload = event.data.json();
      const title = typeof payload.title === "string" ? payload.title.slice(0, 100) : "🥙 بوفية شهيزو – SHAHEZO";
      const body = typeof payload.body === "string" ? payload.body.slice(0, 300) : "تم تحديث حالة طلبك من شهيزو";
      const requestedUrl = typeof payload.url === "string" ? payload.url : "/orders";
      const url = requestedUrl.startsWith("/") && !requestedUrl.startsWith("//") ? requestedUrl : "/orders";
      const tag = typeof payload.tag === "string" ? payload.tag.slice(0, 100) : "shahezo-order-update";
      const isAdminUrl = url.startsWith("/admin");
      await self.registration.showNotification(title, {
        body,
        icon: "/notif-icon-v3.png",
        badge: "/notif-badge-v3.png",
        tag,
        renotify: true,
        requireInteraction: isAdminUrl,
        vibrate: isAdminUrl ? [220, 100, 220, 100, 260] : [180, 80, 180],
        actions: [{ action: "open_order", title: isAdminUrl ? "📋 فتح الطلب في الإدارة" : "📦 تتبع حالة الطلب" }],
        data: { url },
        dir: "rtl",
        lang: "ar",
      });
    } catch (error) {
      console.warn("[PWA] Ignored an invalid push message", error instanceof Error ? error.message : "unknown error");
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
