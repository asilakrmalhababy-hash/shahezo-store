import os, re

# ==============================================================================
# 1. Update client/public/sw.js (v12) for Instant 0ms Installed PWA Launch
# ==============================================================================
sw_code = """const CACHE = "shahezo-shell-v12";
const PRECACHE = ["/", "/offline.html", "/manifest-v9.webmanifest", "/app-icon-192-v8.png", "/chef-hat.png", "/notif-icon-v8.png", "/notif-badge-v8.png"];

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
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin")) return;

  if (url.pathname.startsWith("/assets/") || url.pathname.endsWith(".png") || url.pathname.endsWith(".webp") || url.pathname.endsWith(".webmanifest")) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(resp => {
          if (resp && resp.status === 200) {
            const copy = resp.clone();
            caches.open(CACHE).then(c => c.put(request, copy)).catch(() => {});
          }
          return resp;
        });
      })
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      caches.open(CACHE).then(async cache => {
        const cachedShell = await cache.match("/");
        const networkPromise = fetch(request).then(resp => {
          if (resp && resp.status === 200) {
            cache.put("/", resp.clone()).catch(() => {});
          }
          return resp;
        }).catch(() => cachedShell || cache.match("/offline.html"));
        return cachedShell || networkPromise;
      })
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
        icon: "/notif-icon-v8.png",
        badge: "/notif-badge-v8.png",
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
"""
with open("client/public/sw.js", "w", encoding="utf-8") as f:
    f.write(sw_code)

# ==============================================================================
# 2. Update client/src/contexts/CustomerContext.tsx to accept sequential numbers 1, 2, 3...
# ==============================================================================
with open("client/src/contexts/CustomerContext.tsx", "r", encoding="utf-8") as f:
    cust_ctx = f.read()

cust_ctx = re.sub(
    r"const ORDER_NUMBER_PATTERN = [^\n]+;",
    lambda _: "const ORDER_NUMBER_PATTERN = /^(?:\\d+|(?:SH|OR)-[A-Z0-9]+-[A-Z0-9]{5})$/i;",
    cust_ctx
)
with open("client/src/contexts/CustomerContext.tsx", "w", encoding="utf-8") as f:
    f.write(cust_ctx)

# ==============================================================================
# 3. Update server/commerce.ts for Sequential Order Numbers (1, 2, 3, 4, 5, 6...)
# ==============================================================================
with open("server/commerce.ts", "r", encoding="utf-8") as f:
    comm = f.read()

old_fast_schema = re.search(
    r"async function ensureOrderItemsFastSchema\(dbInstance\?: any\) \{[\s\S]*?\n\}",
    comm
)
new_fast_schema = """async function ensureOrderItemsFastSchema(dbInstance?: any) {
  if (__orderItemsSchemaFixed) return;
  try {
    const db = dbInstance || (await database());
    if (!db) return;
    __orderItemsSchemaFixed = true;
    try { await db.execute(sql.raw("ALTER TABLE order_items MODIFY COLUMN productImage LONGTEXT NULL")); } catch {}
    try { await db.execute(sql.raw("UPDATE order_items SET productImage = CONCAT('/api/fast-img/product/', productId) WHERE productId IS NOT NULL AND productImage LIKE 'data:image/%'")); } catch {}
    try {
      const existingOrders = await db.select({ id: orders.id, orderNumber: orders.orderNumber, city: orders.city })
        .from(orders)
        .orderBy(asc(orders.createdAt), asc(orders.id));
      const realOrders = existingOrders.filter((o: any) => o.city !== "طلب توفير خاص" && !String(o.orderNumber || "").startsWith("REQ-"));
      const needsRenumber = realOrders.some((o: any, idx: number) => String(o.orderNumber) !== String(idx + 1));
      if (needsRenumber) {
        for (let i = 0; i < realOrders.length; i++) {
          const targetNo = String(i + 1);
          if (String(realOrders[i].orderNumber) !== targetNo) {
            await db.update(orders).set({ orderNumber: "TMP-" + realOrders[i].id }).where(eq(orders.id, realOrders[i].id));
          }
        }
        for (let i = 0; i < realOrders.length; i++) {
          const targetNo = String(i + 1);
          await db.update(orders).set({ orderNumber: targetNo }).where(eq(orders.id, realOrders[i].id));
        }
      }
    } catch (e) {
      console.warn("[Orders] Sequential renumber check skipped:", e);
    }
  } catch {}
}"""
if old_fast_schema:
    comm = comm[:old_fast_schema.start()] + new_fast_schema + comm[old_fast_schema.end():]

old_track_sub = re.search(
    r"trackMany: publicProcedure\.input\([\s\S]*?return \{ subscribed: authorized\.length \};\n    \}\),",
    comm
)
new_track_sub = """trackMany: publicProcedure.input(z.object({
      refs: z.array(z.object({
        orderNumber: z.string().trim().min(1).max(40).regex(/^(?:\\d+|(?:SH|OR)-[A-Z0-9]+-[A-Z0-9]{5})$/i),
        idempotencyKey: z.string().uuid(),
      })).min(1).max(50),
    })).query(async ({ input }) => {
      const db = await database();
      await ensureOrderItemsFastSchema(db);
      const referenceByNumber = new Map(input.refs.map(reference => [reference.orderNumber, reference.idempotencyKey]));
      const allLookupKeys = [...new Set([...input.refs.map(r => r.idempotencyKey), ...input.refs.map(r => hashGuestOrderKey(r.idempotencyKey))])];
      const candidates = await db.select().from(orders)
        .where(or(inArray(orders.orderNumber, [...referenceByNumber.keys()]), inArray(orders.idempotencyKey, allLookupKeys)))
        .orderBy(desc(orders.createdAt), desc(orders.id)).limit(50);
      const authorized = candidates.filter(order => {
        const keyByNum = referenceByNumber.get(order.orderNumber);
        if (keyByNum && matchesGuestOrderKey(keyByNum, order.idempotencyKey)) return true;
        return input.refs.some(ref => matchesGuestOrderKey(ref.idempotencyKey, order.idempotencyKey));
      });
      if (!authorized.length) return [];
      const orderIds = authorized.map(order => order.id);
      const [items, events] = await Promise.all([
        db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)),
        db.select({ id: orderEvents.id, orderId: orderEvents.orderId, status: orderEvents.status, note: orderEvents.note, createdAt: orderEvents.createdAt })
          .from(orderEvents).where(inArray(orderEvents.orderId, orderIds)).orderBy(asc(orderEvents.createdAt)),
      ]);
      return authorized.map(order => ({
        orderNumber: order.orderNumber,
        status: order.status,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        discount: order.discount,
        total: order.total,
        city: order.city,
        district: order.district,
        addressDetails: order.addressDetails,
        recipientName: order.recipientName,
        phone: order.phone,
        createdAt: order.createdAt,
        items: items.filter(item => item.orderId === order.id),
        events: events.filter(event => event.orderId === order.id).map(({ id, status, note, createdAt }) => ({ id, status, note, createdAt })),
      }));
    }),
    subscribeToStatus: publicProcedure.input(z.object({
      refs: z.array(z.object({
        orderNumber: z.string().trim().min(1).max(40).regex(/^(?:\\d+|(?:SH|OR)-[A-Z0-9]+-[A-Z0-9]{5})$/i),
        idempotencyKey: z.string().uuid(),
      })).min(1).max(50),
      subscription: pushSubscriptionSchema,
    })).mutation(async ({ input }) => {
      if (!isAllowedPushEndpoint(input.subscription.endpoint)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "خدمة الإشعارات في هذا المتصفح غير مدعومة." });
      }
      const db = await database();
      await ensureOrderItemsFastSchema(db);
      const referenceByNumber = new Map(input.refs.map(reference => [reference.orderNumber, reference.idempotencyKey]));
      const allLookupKeys = [...new Set([...input.refs.map(r => r.idempotencyKey), ...input.refs.map(r => hashGuestOrderKey(r.idempotencyKey))])];
      const candidates = await db.select({ id: orders.id, orderNumber: orders.orderNumber, idempotencyKey: orders.idempotencyKey })
        .from(orders)
        .where(or(inArray(orders.orderNumber, [...referenceByNumber.keys()]), inArray(orders.idempotencyKey, allLookupKeys)))
        .limit(50);
      const authorized = candidates.filter(order => {
        const keyByNum = referenceByNumber.get(order.orderNumber);
        if (keyByNum && matchesGuestOrderKey(keyByNum, order.idempotencyKey)) return true;
        return input.refs.some(ref => matchesGuestOrderKey(ref.idempotencyKey, order.idempotencyKey));
      });
      if (!authorized.length) return { subscribed: 0 };
      const protectedSubscription = protectPushSubscription(input.subscription);
      await db.transaction(async tx => {
        for (const order of authorized) {
          await tx.insert(customerPushSubscriptions).values({
            orderId: order.id,
            ...protectedSubscription,
          }).onDuplicateKeyUpdate({ set: { encryptedPayload: protectedSubscription.encryptedPayload, updatedAt: new Date() } });
        }
      });
      return { subscribed: authorized.length };
    }),"""
if old_track_sub:
    comm = comm[:old_track_sub.start()] + new_track_sub + comm[old_track_sub.end():]

seq_order_gen = """const existingOrderNums = await tx.select({ orderNumber: orders.orderNumber, city: orders.city }).from(orders).for("update");
        let maxOrderSeq = 0;
        let realOrdersCount = 0;
        for (const r of existingOrderNums) {
          const numStr = String(r.orderNumber || "").trim();
          if (r.city !== "طلب توفير خاص" && !numStr.startsWith("REQ-")) {
            realOrdersCount += 1;
          }
          if (/^\\d+$/.test(numStr)) {
            const val = parseInt(numStr, 10);
            if (Number.isFinite(val) && val > maxOrderSeq) maxOrderSeq = val;
          }
        }
        const orderNumber = String(Math.max(maxOrderSeq, realOrdersCount) + 1);"""

comm = re.sub(
    r'const orderNumber = "SH-" \+ Date\.now\(\)\.toString\(36\)\.toUpperCase\(\) \+ "-" \+ nanoid\(5\)\.toUpperCase\(\);',
    lambda _: seq_order_gen,
    comm
)

with open("server/commerce.ts", "w", encoding="utf-8") as f:
    f.write(comm)

# ==============================================================================
# 4. Update client/src/index.css with Premium Luxury AccountPage & Store UX Styles
# ==============================================================================
with open("client/src/index.css", "r", encoding="utf-8") as f:
    css = f.read()

ux_css = """
/* === SHAHEZO_UX_ANIMATIONS_V10_START === */
@keyframes shahezoFloat {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-4px); }
}
@keyframes shahezoPulseDot {
  0%, 100% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(135, 2, 16, 0.42); }
  50% { transform: scale(1.1); opacity: 0.92; box-shadow: 0 0 0 6px rgba(135, 2, 16, 0); }
}
@keyframes shahezoSlideUp {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
.shahezo-empty-hero {
  padding: 28px 18px;
  border-radius: 22px;
  background: linear-gradient(145deg, #ffffff 0%, #fffaf4 100%);
  border: 1.5px solid #ead8cc;
  box-shadow: 0 10px 26px rgba(43, 18, 15, 0.05);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  max-width: 480px;
  margin: 14px auto;
}
.shahezo-empty-icon-ring {
  width: 70px;
  height: 70px;
  border-radius: 22px;
  background: #fceee9;
  border: 1.5px solid #f2cfc6;
  color: #870210;
  display: grid;
  place-items: center;
  animation: shahezoFloat 3.2s ease-in-out infinite;
}
.shahezo-step-dot-active {
  animation: shahezoPulseDot 1.8s infinite;
}
.shahezo-card-enter {
  animation: shahezoSlideUp 0.16s ease-out;
}

/* Luxury Unified AccountPage Design System (v12) */
.shahezo-acc-wrap {
  display: grid;
  gap: 14px;
  max-width: 650px;
  margin: 0 auto;
}
.shahezo-acc-card {
  border-radius: 22px;
  border: 1.5px solid #ead8cc;
  background: #ffffff;
  box-shadow: 0 10px 28px rgba(43, 18, 15, 0.05);
  overflow: hidden;
}
.shahezo-acc-hero {
  position: relative;
  padding: 18px 16px;
  background: radial-gradient(circle at top left, rgba(241, 216, 151, 0.18), transparent 55%), linear-gradient(135deg, #870210 0%, #5c010b 65%, #3d0007 100%);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.shahezo-acc-avatar {
  width: 54px;
  height: 54px;
  border-radius: 17px;
  background: linear-gradient(145deg, rgba(241, 216, 151, 0.26), rgba(241, 216, 151, 0.08));
  border: 2px solid #f1d897;
  color: #f1d897;
  display: grid;
  place-items: center;
  font-weight: 900;
  font-size: 21px;
  flex-shrink: 0;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.22);
}
.shahezo-acc-vip-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 99px;
  background: rgba(241, 216, 151, 0.18);
  color: #f1d897;
  border: 1px solid rgba(241, 216, 151, 0.4);
}
.shahezo-acc-edit-btn {
  padding: 8px 14px;
  border-radius: 12px;
  border: 1.5px solid rgba(241, 216, 151, 0.75);
  background: rgba(255, 255, 255, 0.12);
  color: #f1d897;
  font-weight: 800;
  font-size: 12px;
  cursor: pointer;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  transition: transform 0.14s, background 0.14s;
}
.shahezo-acc-edit-btn:active {
  transform: scale(0.96);
  background: rgba(255, 255, 255, 0.22);
}
.shahezo-acc-shortcuts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9px;
  padding: 14px 12px;
  background: linear-gradient(180deg, #fffcf8 0%, #ffffff 100%);
}
.shahezo-acc-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 6px 10px;
  border-radius: 16px;
  background: #fdf9f4;
  border: 1.5px solid #ead8cc;
  color: #2b120f;
  text-decoration: none;
  box-shadow: 0 4px 10px rgba(43, 18, 15, 0.03);
  transition: transform 0.14s, border-color 0.14s, box-shadow 0.14s;
}
.shahezo-acc-tile:active {
  transform: scale(0.96);
  border-color: #870210;
}
.shahezo-acc-tile-icon {
  position: relative;
  width: 38px;
  height: 38px;
  border-radius: 13px;
  background: linear-gradient(135deg, #fceee9 0%, #fff4eb 100%);
  border: 1px solid #f2cfc6;
  color: #870210;
  display: grid;
  place-items: center;
}
.shahezo-acc-tile-badge {
  position: absolute;
  top: -5px;
  left: -6px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 99px;
  background: #870210;
  color: #f1d897;
  font-size: 10px;
  font-weight: 900;
  display: grid;
  place-items: center;
  border: 1.5px solid #ffffff;
  box-shadow: 0 2px 6px rgba(135, 2, 16, 0.25);
}
.shahezo-acc-tile strong {
  font-size: 12px;
  font-weight: 900;
  color: #2b120f;
  line-height: 1.2;
}
.shahezo-acc-tile small {
  font-size: 10px;
  font-weight: 700;
  color: #7a5e54;
}
.shahezo-acc-sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 16px;
  background: linear-gradient(180deg, #fffdf9 0%, #ffffff 100%);
  border-bottom: 1px solid #f2e5da;
}
.shahezo-acc-sec-title {
  display: flex;
  align-items: center;
  gap: 10px;
}
.shahezo-acc-sec-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: linear-gradient(135deg, #fceee9 0%, #fff4eb 100%);
  border: 1px solid #f2cfc6;
  color: #870210;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.shahezo-acc-addr-item {
  padding: 13px 14px;
  border-radius: 16px;
  background: #fdf9f4;
  border: 1.5px solid #ead8cc;
  display: grid;
  gap: 8px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.shahezo-acc-addr-item.is-default {
  background: linear-gradient(145deg, #fffdf9 0%, #fff6ec 100%);
  border: 2px solid #870210;
  box-shadow: 0 6px 16px rgba(135, 2, 16, 0.06);
}
.shahezo-acc-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  font-weight: 800;
  padding: 3px 9px;
  border-radius: 99px;
  background: #fceee9;
  color: #870210;
  border: 1px solid #f2cfc6;
}
.shahezo-acc-badge-ok {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  font-weight: 800;
  padding: 3px 9px;
  border-radius: 99px;
  background: #edf6eb;
  color: #1f7a4c;
  border: 1px solid #c6e6be;
}
.shahezo-acc-row-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 14px 16px;
  background: #ffffff;
  border: 0;
  border-bottom: 1px solid #f2e5da;
  color: #2b120f;
  text-align: right;
  cursor: pointer;
  transition: background 0.14s;
}
.shahezo-acc-row-btn:last-child {
  border-bottom: 0;
}
.shahezo-acc-row-btn:active {
  background: #fdf9f4;
}
.shahezo-social-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 10px 4px;
  border-radius: 14px;
  text-decoration: none;
  font-size: 10.5px;
  font-weight: 800;
  transition: transform 0.14s, box-shadow 0.14s;
}
.shahezo-social-btn:active {
  transform: scale(0.95);
}
/* === SHAHEZO_UX_ANIMATIONS_V10_END === */
"""
css = re.sub(r"/\* === SHAHEZO_UX_ANIMATIONS_V10_START === \*/[\s\S]*?/\* === SHAHEZO_UX_ANIMATIONS_V10_END === \*/", lambda _: "", css)
css = css.rstrip() + "\n" + ux_css
with open("client/src/index.css", "w", encoding="utf-8") as f:
    f.write(css)

# ==============================================================================
# 5. Update client/src/pages/Admin.tsx
# ==============================================================================
with open("client/src/pages/Admin.tsx", "r", encoding="utf-8") as f:
    admin = f.read()

db_mon_matches = list(re.finditer(r"function DatabaseMonitorCard\(\) \{[\s\S]*?\n\}\n", admin))
if len(db_mon_matches) > 1:
    for m in reversed(db_mon_matches[1:]):
        admin = admin[:m.start()] + admin[m.end():]

old_social_section = re.search(
    r'<section className="admin-form-card" style=\{\{ border: "1\.5px solid #ead8cc", background: "#ffffff" \}\}>[\s\S]*?<h2>🏪 نبذة «من نحن» وروابط حساباتنا الرسمية[\s\S]*?</section>',
    admin
)
new_social_section = """<section className="admin-form-card" style={{ border: "1.5px solid #ead8cc", background: "#ffffff" }}>
      <div className="form-card-heading">
        <span className="form-card-number" style={{ background: "#fceee9", color: "#870210" }}>04</span>
        <div>
          <h2>🏪 نبذة «من نحن» وروابط حساباتنا الرسمية (مع إمكانية إخفاء أو إظهار أي أيقونة)</h2>
          <p>تظهر للزبون في صفحة «حسابي ← من نحن وحساباتنا الرسمية». أزل علامة الصح عن أي أيقونة لإخفائها فوراً من المتجر.</p>
        </div>
      </div>
      <div className="form-fields-grid">
        <label className="field-wide">عنوان النبذة<input value={values.socialLinksConfig.aboutTitle} onChange={e => update("socialLinksConfig", { ...values.socialLinksConfig, aboutTitle: e.target.value })} placeholder="بوفية شهيزو – شهي ولذيذ" /></label>
        <label className="field-wide">نبذة «من نحن» المشوّقة للزبون<textarea rows={3} value={values.socialLinksConfig.aboutText} onChange={e => update("socialLinksConfig", { ...values.socialLinksConfig, aboutText: e.target.value })} placeholder="اكتب نبذة جذابة عن بوفية شهيزو وجودة الطعام وسرعة التوصيل..." /></label>

        <div style={{ padding: "10px 12px", borderRadius: "12px", border: "1px solid #e6ece8", background: "#fafbf9", display: "grid", gap: "6px" }}>
          <label className="toggle-field" style={{ minHeight: "24px", fontWeight: 800, color: "#128C7E" }}>
            <input type="checkbox" checked={(values.socialLinksConfig as any).whatsappEnabled !== false} onChange={e => update("socialLinksConfig", { ...values.socialLinksConfig, whatsappEnabled: e.target.checked } as any)} />
            إظهار أيقونة واتساب
          </label>
          <input dir="ltr" value={values.socialLinksConfig.whatsapp} onChange={e => update("socialLinksConfig", { ...values.socialLinksConfig, whatsapp: e.target.value })} placeholder="https://wa.me/967779542219" />
        </div>

        <div style={{ padding: "10px 12px", borderRadius: "12px", border: "1px solid #e6ece8", background: "#fafbf9", display: "grid", gap: "6px" }}>
          <label className="toggle-field" style={{ minHeight: "24px", fontWeight: 800, color: "#870210" }}>
            <input type="checkbox" checked={(values.socialLinksConfig as any).phoneEnabled !== false} onChange={e => update("socialLinksConfig", { ...values.socialLinksConfig, phoneEnabled: e.target.checked } as any)} />
            إظهار أيقونة الاتصال المباشر
          </label>
          <input dir="ltr" value={values.socialLinksConfig.phone} onChange={e => update("socialLinksConfig", { ...values.socialLinksConfig, phone: e.target.value })} placeholder="779542219" />
        </div>

        <div style={{ padding: "10px 12px", borderRadius: "12px", border: "1px solid #e6ece8", background: "#fafbf9", display: "grid", gap: "6px" }}>
          <label className="toggle-field" style={{ minHeight: "24px", fontWeight: 800, color: "#1877F2" }}>
            <input type="checkbox" checked={(values.socialLinksConfig as any).facebookEnabled !== false} onChange={e => update("socialLinksConfig", { ...values.socialLinksConfig, facebookEnabled: e.target.checked } as any)} />
            إظهار أيقونة فيسبوك
          </label>
          <input dir="ltr" value={values.socialLinksConfig.facebook} onChange={e => update("socialLinksConfig", { ...values.socialLinksConfig, facebook: e.target.value })} placeholder="https://facebook.com/shizo.ye" />
        </div>

        <div style={{ padding: "10px 12px", borderRadius: "12px", border: "1px solid #e6ece8", background: "#fafbf9", display: "grid", gap: "6px" }}>
          <label className="toggle-field" style={{ minHeight: "24px", fontWeight: 800, color: "#E1306C" }}>
            <input type="checkbox" checked={(values.socialLinksConfig as any).instagramEnabled !== false} onChange={e => update("socialLinksConfig", { ...values.socialLinksConfig, instagramEnabled: e.target.checked } as any)} />
            إظهار أيقونة إنستغرام
          </label>
          <input dir="ltr" value={values.socialLinksConfig.instagram} onChange={e => update("socialLinksConfig", { ...values.socialLinksConfig, instagram: e.target.value })} placeholder="https://instagram.com/shizo.ye" />
        </div>

        <div className="field-wide" style={{ padding: "10px 12px", borderRadius: "12px", border: "1px solid #e6ece8", background: "#fafbf9", display: "grid", gap: "6px" }}>
          <label className="toggle-field" style={{ minHeight: "24px", fontWeight: 800, color: "#18181b" }}>
            <input type="checkbox" checked={(values.socialLinksConfig as any).tiktokEnabled !== false} onChange={e => update("socialLinksConfig", { ...values.socialLinksConfig, tiktokEnabled: e.target.checked } as any)} />
            إظهار أيقونة تيك توك
          </label>
          <input dir="ltr" value={values.socialLinksConfig.tiktok} onChange={e => update("socialLinksConfig", { ...values.socialLinksConfig, tiktok: e.target.value })} placeholder="https://tiktok.com/@shizo.ye" />
        </div>
      </div>
    </section>"""

if old_social_section:
    admin = admin[:old_social_section.start()] + new_social_section + admin[old_social_section.end():]

if "whatsappEnabled: parsed.whatsappEnabled !== false" not in admin:
    admin = admin.replace(
        '            phone: parsed.phone || "779542219",\n          };',
        """            phone: parsed.phone || "779542219",
            whatsappEnabled: parsed.whatsappEnabled !== false,
            facebookEnabled: parsed.facebookEnabled !== false,
            instagramEnabled: parsed.instagramEnabled !== false,
            tiktokEnabled: parsed.tiktokEnabled !== false,
            phoneEnabled: parsed.phoneEnabled !== false,
          };""",
        1
    )

admin = admin.replace(
    '<div><strong className="order-number">{order.orderNumber}</strong><small>{new Date(order.createdAt).toLocaleString("ar-YE")}</small></div>',
    '<div><strong className="order-number">طلب #{order.orderNumber}</strong><small>{new Date(order.createdAt).toLocaleString("ar-YE")}</small></div>'
)
admin = admin.replace(
    '<span className="order-number">{order.orderNumber}</span>',
    '<span className="order-number">طلب #{order.orderNumber}</span>'
)

with open("client/src/pages/Admin.tsx", "w", encoding="utf-8") as f:
    f.write(admin)

# ==============================================================================
# 6. Update client/src/pages/Home.tsx:
#    - Guarantee ShahezoWhatsAppBar is ALWAYS defined once before BottomNav
#    - Luxury AccountPage v12 + CartPage + FavoritesPage + OrdersPage
# ==============================================================================
with open("client/src/pages/Home.tsx", "r", encoding="utf-8") as f:
    home = f.read()

home = re.sub(
    r"// === SHAHEZO_WA_BAR_START ===[\s\S]*?// === SHAHEZO_WA_BAR_END ===\s*",
    lambda _: "",
    home
)
home = re.sub(
    r"function ShahezoWhatsAppBar\(\) \{[\s\S]*?\n\}\n",
    lambda _: "",
    home
)

new_wa_fn = """// === SHAHEZO_WA_BAR_START ===
function ShahezoWhatsAppBar() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setOpen(false);
    const onToggle = () => setOpen(prev => !prev);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("toggle-shahezo-wa", onToggle);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("toggle-shahezo-wa", onToggle);
    };
  }, []);
  if (location.startsWith("/account") || location.startsWith("/cart") || location.startsWith("/assistant")) {
    return null;
  }
  return (
    <div className="shahezo-wa-widget" aria-label="تواصل مباشر مع بوفية شهيزو">
      <button
        type="button"
        className={`shahezo-wa-fab ${open ? "is-open" : ""}`}
        onClick={() => setOpen(prev => !prev)}
        aria-label="تواصل واتساب مع بوفية شهيزو"
        title="تواصل معنا عبر واتساب"
      >
        <MessageCircle size={24} />
      </button>
      <div className={`shahezo-wa-strip ${open ? "is-open" : "is-closed"}`}>
        <div className="shahezo-wa-strip-head">
          <strong>🥙 تواصل مباشر · بوفية شهيزو</strong>
          <button type="button" className="shahezo-wa-close" onClick={() => setOpen(false)} aria-label="إغلاق">×</button>
        </div>
        <div className="shahezo-wa-row">
          <div className="shahezo-wa-label">
            <span>للطلب والاستفسار</span>
            <b dir="ltr">779 542 219</b>
          </div>
          <div className="shahezo-wa-actions">
            <a className="shahezo-wa-btn" href="https://wa.me/967779542219?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D9%8B%20%D8%A8%D9%88%D9%81%D9%8A%D8%A9%20%D8%B4%D9%87%D9%8A%D8%B2%D9%88%20%F0%9F%A5%99%D8%8C%20%D8%A3%D8%B1%D9%8A%D8%AF%20%D8%A7%D9%84%D8%B7%D9%84%D8%A8%20%D8%A3%D9%88%20%D8%A7%D9%84%D8%A7%D8%B3%D8%AA%D9%81%D8%B3%D8%A7%D8%B1" target="_blank" rel="noreferrer">واتساب</a>
            <a className="shahezo-call-btn" href="tel:779542219">اتصال</a>
          </div>
        </div>
        <div className="shahezo-wa-row">
          <div className="shahezo-wa-label">
            <span>خدمة العملاء</span>
            <b dir="ltr">772 206 455</b>
          </div>
          <div className="shahezo-wa-actions">
            <a className="shahezo-wa-btn" href="https://wa.me/967772206455?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D9%8B%20%D8%AE%D8%AF%D9%85%D8%A9%20%D8%B9%D9%85%D9%84%D8%A7%D8%A1%20%D8%A8%D9%88%D9%81%D9%8A%D8%A9%20%D8%B4%D9%87%D9%8A%D8%B2%D9%88%20%F0%9F%A5%99" target="_blank" rel="noreferrer">واتساب</a>
            <a className="shahezo-call-btn" href="tel:772206455">اتصال</a>
          </div>
        </div>
      </div>
    </div>
  );
}
// === SHAHEZO_WA_BAR_END ===

"""
home = home.replace("function BottomNav(", new_wa_fn + "function BottomNav(", 1)

new_cart_block = """function CartPage({ minOrder = 0 }: { minOrder?: number }) {
  const { cart, setQuantity, remove, clear } = useStore();
  const [checkout, setCheckout] = useState(false);
  const subtotal = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const totalItemsCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const belowMin = minOrder > 0 && subtotal < minOrder;

  return (
    <main className="page-shell inner-page" style={{ paddingTop: "12px", paddingBottom: "28px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          padding: "12px 16px",
          borderRadius: "18px",
          background: "#ffffff",
          border: "1.5px solid #ead8cc",
          boxShadow: "0 6px 18px rgba(43, 18, 15, 0.04)",
          marginBottom: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ width: "42px", height: "42px", borderRadius: "13px", background: "linear-gradient(135deg, #870210 0%, #5e010b 100%)", color: "#f1d897", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <ShoppingCart size={20} />
          </span>
          <div>
            <h1 style={{ margin: 0, fontSize: "17px", fontWeight: 900, color: "#2b120f" }}>سلة التسوق</h1>
            <small style={{ fontSize: "11px", color: "#7a5e54", fontWeight: 700 }}>
              {cart.length > 0 ? `${cart.length} أصناف (${totalItemsCount} وحدة) جاهزة للطلب` : "سلتك فارغة حالياً"}
            </small>
          </div>
        </div>
        {cart.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm("هل تريد إفراغ السلة بالكامل؟")) clear();
            }}
            style={{
              padding: "6px 11px",
              borderRadius: "10px",
              border: "1px solid #f2cfc6",
              background: "#fff5f4",
              color: "#b42318",
              fontSize: "11px",
              fontWeight: 800,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <Trash2 size={13} /> إفراغ السلة
          </button>
        )}
      </div>

      {!cart.length ? (
        <div className="shahezo-empty-hero">
          <div className="shahezo-empty-icon-ring">
            <ShoppingCart size={32} strokeWidth={1.8} />
          </div>
          <div style={{ display: "grid", gap: "5px" }}>
            <strong style={{ fontSize: "17px", color: "#2b120f", fontWeight: 900 }}>سلتك بانتظار أشهى الوجبات الساخنة! 🥙</strong>
            <p style={{ margin: 0, fontSize: "12px", color: "#6e564d", lineHeight: 1.65, maxWidth: "340px" }}>
              لم تضف أي طلبات للسلة بعد. استكشف تشكيلة الشاورما والفلافل المقرمشة والعصائر الطازجة أو تصفح عروض التوفير الآن.
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "9px", width: "100%", marginTop: "4px" }}>
            <Link href="/products" className="button button-primary" style={{ flex: "1 1 160px", maxWidth: "220px", textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
              <ShoppingBag size={16} /> تسوق المتجر الآن
            </Link>
            <Link href="/products?offers=1" className="button" style={{ flex: "1 1 150px", maxWidth: "200px", textDecoration: "none", background: "#fdf9f4", color: "#870210", border: "1.5px solid #ead8cc", fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
              <BadgePercent size={16} /> قسم العروضات
            </Link>
          </div>
        </div>
      ) : (
        <div className="cart-layout shahezo-card-enter">
          <div className="cart-list" style={{ borderRadius: "20px", border: "1.5px solid #ead8cc", background: "#ffffff", padding: "8px 14px", boxShadow: "0 6px 18px rgba(43, 18, 15, 0.04)" }}>
            {cart.map(line => (
              <CartRow
                key={line.id}
                line={line}
                onQuantity={quantity => setQuantity(line.id, quantity)}
                onRemove={() => remove(line.id)}
              />
            ))}
          </div>
          <aside className="summary-card" style={{ borderRadius: "20px", border: "1.5px solid #ead8cc", background: "linear-gradient(180deg, #ffffff 0%, #fffaf5 100%)", boxShadow: "0 8px 22px rgba(43, 18, 15, 0.05)" }}>
            <span className="eyebrow" style={{ color: "#870210", fontWeight: 800 }}>فاتورة طلبك المبدئية</span>
            <div className="summary-line">
              <span>عدد الأصناف</span>
              <strong>{cart.length} أصناف ({totalItemsCount} وحدة)</strong>
            </div>
            <div className="summary-line">
              <span>المجموع الفرعي</span>
              <strong>{formatPrice(subtotal)}</strong>
            </div>
            {minOrder > 0 && (
              <div className="summary-line">
                <span>الحد الأدنى للطلب</span>
                <strong>{formatPrice(minOrder)}</strong>
              </div>
            )}
            <div className="summary-line">
              <span>رسوم التوصيل</span>
              <span style={{ fontSize: "11px", color: "#870210", fontWeight: 700 }}>تُحسب تلقائياً عند اختيار الحي</span>
            </div>
            <div className="summary-total" style={{ borderTop: "1.5px dashed #e5d2c3", marginTop: "6px", paddingTop: "12px" }}>
              <span style={{ fontWeight: 800, color: "#2b120f" }}>الإجمالي الحالي</span>
              <strong style={{ fontSize: "19px", color: "#870210" }}>{formatPrice(subtotal)}</strong>
            </div>
            {belowMin && (
              <p
                style={{
                  color: "#b42318",
                  background: "#fef3f2",
                  border: "1px solid #fecdca",
                  padding: "9px 11px",
                  borderRadius: "12px",
                  fontWeight: 700,
                  fontSize: "11.5px",
                  margin: "8px 0",
                }}
              >
                ⚠️ الحد الأدنى للطلب هو {formatPrice(minOrder)} — أضف منتجات بقيمة {formatPrice(minOrder - subtotal)} لإتمام الطلب.
              </p>
            )}
            <button
              type="button"
              className="button button-primary full-button"
              style={{ marginTop: "8px", minHeight: "46px", fontSize: "14px", fontWeight: 900, borderRadius: "14px" }}
              onClick={() => {
                if (belowMin) {
                  toast.error(`الحد الأدنى للطلب من المتجر هو ${formatPrice(minOrder)} (متبقي ${formatPrice(minOrder - subtotal)})`);
                  return;
                }
                setCheckout(true);
              }}
            >
              <Check size={17} /> المتابعة لإتمام الطلب ({formatPrice(subtotal)}) <ArrowLeft size={16} />
            </button>
            {checkout && <Checkout onClose={() => setCheckout(false)} onSuccess={clear} cart={cart} />}
          </aside>
        </div>
      )}
    </main>
  );
}

function CartRow({ line, onQuantity, onRemove }: { line: CartLine; onQuantity: (n: number) => void; onRemove: () => void }) {
  return (
    <article className="cart-row" style={{ padding: "12px 0", borderBottom: "1px solid #f5ebe3" }}>
      <div className="cart-thumb" style={{ borderRadius: "14px", overflow: "hidden", border: "1px solid #ead8cc" }}>
        {line.imageUrl ? <img src={line.imageUrl} alt="" loading="lazy" decoding="async" /> : <Leaf size={22} />}
      </div>
      <div className="cart-row-info">
        <strong style={{ fontSize: "13.5px", color: "#2b120f" }}>{line.name}</strong>
        <small style={{ color: "#7a5e54", fontWeight: 600 }}>{formatPrice(line.price)} / {line.unit}</small>
        <div className="cart-row-tools" style={{ marginTop: "6px" }}>
          <div className="quantity-compact" style={{ background: "#fdf9f4", border: "1px solid #ead8cc", borderRadius: "10px" }}>
            <button type="button" aria-label="تقليل" onClick={() => onQuantity(line.quantity - (line.quantityStep || 1))}><Minus size={14} /></button>
            <b style={{ color: "#870210", minWidth: "22px", textAlign: "center" }}>{line.quantity}</b>
            <button type="button" aria-label="زيادة" disabled={line.stock !== null && line.stock !== undefined && line.quantity + (line.quantityStep || 1) > line.stock} onClick={() => onQuantity(line.quantity + (line.quantityStep || 1))}><Plus size={14} /></button>
          </div>
          <button type="button" className="remove-line" onClick={onRemove} style={{ color: "#b42318", fontWeight: 700 }}>
            <Trash2 size={14} /> حذف
          </button>
        </div>
      </div>
      <strong className="cart-line-total" style={{ fontSize: "14px", color: "#870210", fontWeight: 900 }}>
        {formatPrice(line.price * line.quantity)}
      </strong>
    </article>
  );
}"""

home = re.sub(
    r"function CartPage\([\s\S]*?(?=\nfunction getYemenCarrierName)",
    lambda _: new_cart_block + "\n\n",
    home,
    count=1
)

new_fav_orders_account_block = """function FavoritesPage({ allProducts = [] }: { allProducts?: PublicProduct[] }) {
  const { favoriteIds, add } = useStore();
  const [, navigate] = useLocation();
  const localMatched = useMemo(
    () => (allProducts.length > 0 ? allProducts.filter(p => favoriteIds.includes(p.id)) : []),
    [allProducts, favoriteIds]
  );
  const needRemote = favoriteIds.length > 0 && allProducts.length === 0;
  const query = trpc.commerce.catalog.productsForReorder.useQuery(
    { ids: favoriteIds },
    { enabled: needRemote, retry: 1, staleTime: 60_000 }
  );
  const products = (allProducts.length > 0 ? localMatched : (query.data ?? [])) as PublicProduct[];

  const addAllFavoritesToCart = () => {
    let count = 0;
    for (const p of products) {
      if (p.stock !== null && p.stock < (p.minQuantity || 1)) continue;
      add(p, p.minQuantity || 1);
      count += 1;
    }
    if (count > 0) toast.success(`🛒 تمت إضافة ${count} أصناف من مفضلتك إلى السلة!`);
    else toast.error("لا توجد أصناف متاحة للإضافة حالياً");
  };

  return (
    <main className="page-shell inner-page" style={{ paddingTop: "12px", paddingBottom: "28px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
          padding: "12px 16px",
          borderRadius: "18px",
          background: "#ffffff",
          border: "1.5px solid #ead8cc",
          boxShadow: "0 6px 18px rgba(43, 18, 15, 0.04)",
          marginBottom: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ width: "42px", height: "42px", borderRadius: "13px", background: "linear-gradient(135deg, #870210 0%, #5e010b 100%)", color: "#f1d897", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Heart size={20} fill="currentColor" />
          </span>
          <div>
            <h1 style={{ margin: 0, fontSize: "17px", fontWeight: 900, color: "#2b120f" }}>قائمتي المفضلة</h1>
            <small style={{ fontSize: "11px", color: "#7a5e54", fontWeight: 700 }}>
              {favoriteIds.length > 0 ? `${favoriteIds.length} وجبات وأصناف محفوظة لطلبها سريعاً` : "احتفظ بوجباتك المفضلة هنا"}
            </small>
          </div>
        </div>
        {products.length > 0 && (
          <button
            type="button"
            onClick={addAllFavoritesToCart}
            className="small-button selected"
            style={{ background: "#870210", color: "#ffffff", border: "none", padding: "8px 13px", borderRadius: "11px", fontWeight: 800, fontSize: "11.5px" }}
          >
            <ShoppingCart size={14} /> أضف الكل للسلة
          </button>
        )}
      </div>

      {needRemote && query.isLoading ? (
        <Loading />
      ) : needRemote && query.error ? (
        <LoadError onRetry={() => void query.refetch()} />
      ) : !favoriteIds.length ? (
        <div className="shahezo-empty-hero">
          <div className="shahezo-empty-icon-ring">
            <Heart size={32} strokeWidth={1.8} />
          </div>
          <div style={{ display: "grid", gap: "5px" }}>
            <strong style={{ fontSize: "17px", color: "#2b120f", fontWeight: 900 }}>قائمة المفضلة فارغة حالياً ❤️</strong>
            <p style={{ margin: 0, fontSize: "12px", color: "#6e564d", lineHeight: 1.65, maxWidth: "340px" }}>
              اضغط على رمز القلب بأعلى أي وجبة أو عصير في المتجر لحفظه هنا والوصول إليه بنقرة واحدة متى ما اشتهيته!
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "9px", width: "100%", marginTop: "4px" }}>
            <Link href="/products" className="button button-primary" style={{ flex: "1 1 160px", maxWidth: "220px", textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
              <ShoppingBag size={16} /> استكشف قائمة الطعام
            </Link>
          </div>
        </div>
      ) : !products.length ? (
        <EmptyState icon={Heart} title="لا توجد منتجات متاحة من مفضلتك الآن" description="قد تكون المنتجات التي حفظتها أُخفيت أو نفدت." action="تصفح المنتجات" href="/products" />
      ) : (
        <div className="shahezo-card-enter">
          <ProductGrid items={products} onOpen={id => navigate("/product/" + id)} />
        </div>
      )}
    </main>
  );
}

function OrdersPage() {
  const customer = useCustomer();
  const { add } = useStore();
  const searchStr = useSearch();
  const searchParams = new URLSearchParams(searchStr);
  const focusedOrderNumber = searchParams.get("order");
  const refs = useMemo(() => customer.orders.slice(0, 50).map(({ orderNumber, idempotencyKey }) => ({ orderNumber, idempotencyKey })), [customer.orders]);
  const query = trpc.commerce.orders.trackMany.useQuery({ refs }, { enabled: refs.length > 0, retry: 1, staleTime: 25_000, refetchInterval: refs.length ? 45_000 : false, refetchIntervalInBackground: false });
  const publicKey = trpc.commerce.notifications.publicKey.useQuery(undefined, { enabled: false, retry: 1 });
  const subscribe = trpc.commerce.orders.subscribeToStatus.useMutation();
  const [reorder, setReorder] = useState<Array<{ productId: number; quantity: number }> | null>(null);
  const reorderQuery = trpc.commerce.catalog.productsForReorder.useQuery({ ids: reorder?.map(item => item.productId) ?? [1] }, { enabled: Boolean(reorder), retry: 1 });
  const [expandedOrderNo, setExpandedOrderNo] = useState<string | null>(focusedOrderNumber);

  useEffect(() => {
    if (!refs.length) return;
    if (getPushPermissionState() === "default") {
      try {
        if (!localStorage.getItem("shahezo-orders-push-asked-v1")) {
          localStorage.setItem("shahezo-orders-push-asked-v1", "1");
          void requestPushPermission();
        }
      } catch {}
    }
  }, [refs.length]);

  useEffect(() => {
    if (!refs.length || getPushPermissionState() !== "granted") return;
    let active = true;
    void (async () => {
      try {
        let subscription = await getExistingBrowserPushSubscription();
        if (!subscription) {
          const key = publicKey.data ?? (await publicKey.refetch()).data;
          if (key) subscription = await ensureBrowserPushSubscription(key);
        }
        if (!subscription || !active) return;
        await subscribe.mutateAsync({ refs, subscription });
      } catch {}
    })();
    return () => { active = false; };
  }, [refs.length]);

  useEffect(() => {
    if (!reorder || !reorderQuery.data) return;
    let added = 0;
    for (const line of reorder) {
      const product = reorderQuery.data.find(candidate => candidate.id === line.productId);
      if (!product) continue;
      const minimum = product.minQuantity || 1;
      const step = product.quantityStep || 1;
      let quantity = minimum + Math.max(0, Math.floor((Math.max(minimum, line.quantity) - minimum) / step)) * step;
      if (product.stock !== null) {
        const bounded = Math.min(quantity, product.stock);
        quantity = minimum + Math.max(0, Math.floor((bounded - minimum) / step)) * step;
        if (quantity > product.stock) continue;
      }
      add(product, quantity);
      added += 1;
    }
    if (added) toast.success("🛒 أُضيفت أصناف الطلب (" + added + ") إلى السلة بنجاح!");
    else toast.error("لا توجد منتجات متاحة من هذا الطلب الآن.");
    setReorder(null);
  }, [reorder, reorderQuery.data, add]);

  const orders = useMemo(() => {
    const raw = [...(query.data ?? [])];
    raw.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return raw;
  }, [query.data]);

  useEffect(() => {
    if (orders.length > 0 && expandedOrderNo === null) {
      setExpandedOrderNo(focusedOrderNumber || orders[0].orderNumber);
    }
  }, [orders.length, focusedOrderNumber]);

  const stepOrder = ["new", "preparing", "ready", "out_for_delivery", "delivered"];
  const stepMeta: Record<string, { label: string; emoji: string }> = {
    new: { label: "تم الاستلام", emoji: "📥" },
    preparing: { label: "قيد التجهيز", emoji: "👨‍🍳" },
    ready: { label: "جاهز", emoji: "📦" },
    out_for_delivery: { label: "خرج للتوصيل", emoji: "🛵" },
    delivered: { label: "تم التسليم", emoji: "✅" },
  };

  const activeOrdersCount = orders.filter(o => o.status !== "delivered" && o.status !== "cancelled").length;

  return (
    <main className="page-shell inner-page" style={{ paddingTop: "12px", paddingBottom: "28px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
          padding: "12px 16px",
          borderRadius: "18px",
          background: "#ffffff",
          border: "1.5px solid #ead8cc",
          boxShadow: "0 6px 18px rgba(43, 18, 15, 0.04)",
          marginBottom: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ width: "42px", height: "42px", borderRadius: "13px", background: "linear-gradient(135deg, #870210 0%, #5e010b 100%)", color: "#f1d897", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Package size={20} />
          </span>
          <div>
            <h1 style={{ margin: 0, fontSize: "17px", fontWeight: 900, color: "#2b120f" }}>طلباتي ومتابعة التوصيل</h1>
            <small style={{ fontSize: "11px", color: "#7a5e54", fontWeight: 700 }}>
              {orders.length > 0 ? `إجمالي الطلبات: ${orders.length}` + (activeOrdersCount > 0 ? ` · (${activeOrdersCount} قيد التنفيذ الآن 🔥)` : "") : "تتبع حالة طلباتك خطوة بخطوة"}
            </small>
          </div>
        </div>
        {orders.length > 0 && (
          <button
            type="button"
            onClick={() => { void query.refetch(); toast.success("تم تحديث حالة الطلبات"); }}
            className="small-button"
            style={{ background: "#fdf9f4", border: "1px solid #ead8cc", color: "#870210", fontWeight: 800 }}
          >
            🔄 تحديث الحالة
          </button>
        )}
      </div>

      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <LoadError onRetry={() => void query.refetch()} />
      ) : !orders.length ? (
        <div className="shahezo-empty-hero">
          <div className="shahezo-empty-icon-ring">
            <Package size={32} strokeWidth={1.8} />
          </div>
          <div style={{ display: "grid", gap: "5px" }}>
            <strong style={{ fontSize: "17px", color: "#2b120f", fontWeight: 900 }}>لا توجد طلبات مسجلة بعد 📦</strong>
            <p style={{ margin: 0, fontSize: "12px", color: "#6e564d", lineHeight: 1.65, maxWidth: "340px" }}>
              بمجرد إرسال أول طلب لك من بوفية شهيزو، ستظهر فاتورته ورقمه التسلسلي ومراحل تجهيزه وتوصيله هنا لحظة بلحظة!
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "9px", width: "100%", marginTop: "4px" }}>
            <Link href="/products" className="button button-primary" style={{ flex: "1 1 160px", maxWidth: "220px", textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
              <ShoppingBag size={16} /> اطلب وجبتك الآن
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "12px" }} className="shahezo-card-enter">
          {orders.map((order, idx) => {
            const isLatest = idx === 0;
            const isExpanded = expandedOrderNo === order.orderNumber;
            const currentStepIdx = stepOrder.indexOf(order.status);
            const cancelledNotes = (order.events || []).filter(ev => String(ev.note || "").startsWith("❌")).map(ev => String(ev.note || "").replace(/\\s*\\|\\s*الإجمالي الجديد:.*$/, ""));
            const regularNotes = (order.events || []).filter(ev => ev.note && ev.note.trim() && ev.note !== "تم استلام الطلب" && !String(ev.note).startsWith("❌"));
            const latestStoreNote = regularNotes.at(-1);
            const ordAny = order as any;
            const displayOrderNo = /^\\d+$/.test(String(order.orderNumber)) ? order.orderNumber : String(orders.length - idx);

            return (
              <article
                key={order.orderNumber}
                style={{
                  borderRadius: "20px",
                  background: "#ffffff",
                  border: isExpanded ? "2px solid #870210" : "1.5px solid #ead8cc",
                  boxShadow: isExpanded ? "0 10px 24px rgba(135, 2, 16, 0.07)" : "0 4px 12px rgba(43, 18, 15, 0.04)",
                  overflow: "hidden",
                  transition: "border-color 0.18s, box-shadow 0.18s",
                }}
              >
                <div
                  onClick={() => setExpandedOrderNo(isExpanded ? "" : order.orderNumber)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === "Enter") setExpandedOrderNo(isExpanded ? "" : order.orderNumber); }}
                  style={{
                    padding: "14px 16px",
                    background: isExpanded ? "linear-gradient(135deg, #fffdf9 0%, #fff5eb 100%)" : "#ffffff",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "10px",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "grid", gap: "3px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: "15px", color: "#2b120f" }}>طلب #{displayOrderNo}</strong>
                      {isLatest && (
                        <span style={{ fontSize: "10px", fontWeight: 900, padding: "2px 8px", borderRadius: "99px", background: "#870210", color: "#f1d897" }}>
                          ✨ الأحدث
                        </span>
                      )}
                      <span className={"status-pill status-" + order.status}>{stateLabels[order.status] || order.status}</span>
                    </div>
                    <small style={{ color: "#7a5e54", fontSize: "11px", fontWeight: 600 }}>
                      🕒 {new Date(order.createdAt).toLocaleString("ar-YE")} · {order.items.length} أصناف
                    </small>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ textAlign: "left" }}>
                      <strong style={{ display: "block", fontSize: "15.5px", color: "#870210", fontWeight: 900 }}>{formatPrice(order.total)}</strong>
                      <small style={{ fontSize: "10px", color: "#870210", fontWeight: 800 }}>
                        {isExpanded ? "إخفاء التفاصيل ▴" : "عرض التفاصيل ▾"}
                      </small>
                    </div>
                  </div>
                </div>

                {(isExpanded || (isLatest && order.status !== "delivered" && order.status !== "cancelled")) && order.status !== "cancelled" && (
                  <div style={{ padding: "12px 14px", background: "#fdf9f4", borderTop: "1px solid #f2e4d8", borderBottom: isExpanded ? "1px solid #f2e4d8" : "none" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px" }}>
                      {stepOrder.map((st, sIdx) => {
                        const done = currentStepIdx >= sIdx;
                        const active = currentStepIdx === sIdx;
                        const meta = stepMeta[st];
                        return (
                          <div key={st} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "5px", textAlign: "center" }}>
                            <span
                              className={active ? "shahezo-step-dot-active" : ""}
                              style={{
                                width: "30px",
                                height: "30px",
                                borderRadius: "50%",
                                background: active ? "#870210" : done ? "#fceee9" : "#eee6df",
                                border: active ? "2px solid #f1d897" : done ? "1.5px solid #870210" : "1px solid #d8cbc0",
                                display: "grid",
                                placeItems: "center",
                                fontSize: "13px",
                              }}
                            >
                              {meta.emoji}
                            </span>
                            <div style={{ width: "100%", height: "4px", borderRadius: "99px", background: done ? "linear-gradient(90deg, #870210, #e86c12)" : "#e2d6cc" }} />
                            <span style={{ fontSize: "9.5px", fontWeight: active ? 900 : 700, color: active ? "#870210" : done ? "#2b120f" : "#96827a", lineHeight: 1.2 }}>
                              {meta.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {isExpanded && (
                  <div style={{ padding: "14px 16px", display: "grid", gap: "11px" }}>
                    {ordAny.city && (
                      <div style={{ fontSize: "11.5px", color: "#5c433b", background: "#fffaf5", padding: "8px 11px", borderRadius: "10px", border: "1px solid #f0e0d2" }}>
                        📍 <strong>عنوان التوصيل:</strong> {ordAny.city}{ordAny.district ? (" — " + ordAny.district) : ""}{ordAny.addressDetails ? (" · " + ordAny.addressDetails) : ""}
                      </div>
                    )}

                    {cancelledNotes.length > 0 && (
                      <div style={{ padding: "10px 12px", borderRadius: "12px", background: "#fff6f4", border: "1px solid #f0c6be", display: "grid", gap: "4px" }}>
                        <strong style={{ fontSize: "12px", color: "#8f3225" }}>🔔 تحديث على فاتورة الطلب:</strong>
                        {cancelledNotes.map((cn, cIdx) => (
                          <div key={cIdx} style={{ fontSize: "11.5px", color: "#5e251d", lineHeight: 1.55 }}>{cn}</div>
                        ))}
                      </div>
                    )}

                    {latestStoreNote?.note && (
                      <div style={{ padding: "10px 12px", borderRadius: "12px", background: "#fff9e8", border: "1px solid #edd691", color: "#574208", fontSize: "12px", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                        <BellRing size={15} />
                        <span>رسالة المتجر: {latestStoreNote.note}</span>
                      </div>
                    )}

                    <div style={{ padding: "10px 12px", borderRadius: "14px", background: "#fdf9f4", border: "1px solid #ead8cc", display: "grid", gap: "7px" }}>
                      <small style={{ fontSize: "11px", fontWeight: 800, color: "#6e564d" }}>🛒 تفاصيل الأصناف ({order.items.length}):</small>
                      <div style={{ display: "grid", gap: "5px" }}>
                        {order.items.map(item => (
                          <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", borderRadius: "10px", background: "#ffffff", border: "1px solid #efe2d7", fontSize: "12px" }}>
                            <span style={{ fontWeight: 700, color: "#2b120f" }}>
                              {item.productName} <strong style={{ color: "#870210" }}>× {item.quantity}</strong>
                            </span>
                            {item.lineTotal > 0 && <strong style={{ color: "#870210", fontSize: "12px" }}>{formatPrice(item.lineTotal)}</strong>}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", paddingTop: "4px" }}>
                      <div>
                        <small style={{ display: "block", fontSize: "10.5px", color: "#7a5e54" }}>
                          الفرعي: {formatPrice(order.subtotal)} · التوصيل: {formatPrice(order.deliveryFee)}
                        </small>
                        <strong style={{ fontSize: "16px", color: "#870210" }}>الإجمالي: {formatPrice(order.total)}</strong>
                      </div>
                      <button
                        type="button"
                        className="small-button selected"
                        disabled={reorderQuery.isFetching}
                        onClick={() => {
                          const validItems = order.items.filter(item => item.productId !== null).map(item => ({ productId: item.productId!, quantity: item.quantity }));
                          if (!validItems.length) { toast.error("لم تعد منتجات هذا الطلب متاحة في المتجر."); return; }
                          setReorder(validItems);
                        }}
                        style={{ padding: "8px 14px", borderRadius: "11px", fontWeight: 800, background: "#870210", color: "#ffffff", border: "none" }}
                      >
                        🔄 إعادة الطلب للسلة
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}

function useGuestPushSubscriptionSync() {
  const customer = useCustomer();
  const refs = useMemo(() => customer.orders.slice(0, 50).map(({ orderNumber, idempotencyKey }) => ({ orderNumber, idempotencyKey })), [customer.orders]);
  const subscribe = trpc.commerce.orders.subscribeToStatus.useMutation();
  const publicKey = trpc.commerce.notifications.publicKey.useQuery(undefined, { enabled: false, retry: 1 });
  useEffect(() => {
    if (!refs.length || getPushPermissionState() !== "granted") return;
    let active = true;
    void (async () => {
      try {
        let subscription = await getExistingBrowserPushSubscription();
        if (!subscription) {
          const key = publicKey.data ?? (await publicKey.refetch()).data;
          if (key) subscription = await ensureBrowserPushSubscription(key);
        }
        if (!subscription || !active) return;
        await subscribe.mutateAsync({ refs, subscription });
      } catch {}
    })();
    return () => { active = false; };
  }, [refs.length]);
}

function AccountPage({ settings = {} }: { settings?: Record<string, string | undefined> }) {
  const customer = useCustomer();
  const { cart, favoriteIds } = useStore();
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const deliveryTree = useMemo(() => readPublicDeliveryTree(settings?.deliveryTreeConfig), [settings?.deliveryTreeConfig]);
  const cleanedCustomerPhone = cleanYemeniPhone(customer.phone);
  const hasSavedProfile = Boolean(customer.name.trim().length >= 2 && isValidYemeniPhone(cleanedCustomerPhone));
  const [isEditingProfile, setIsEditingProfile] = useState(!hasSavedProfile);
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(cleanedCustomerPhone);

  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [address, setAddress] = useState({
    label: "المنزل",
    recipientName: customer.name,
    phone: cleanedCustomerPhone,
    city: "صنعاء",
    district: "",
    details: "",
    isDefault: customer.addresses.length === 0,
  });

  useEffect(() => {
    const cp = cleanYemeniPhone(customer.phone);
    setName(customer.name);
    setPhone(cp);
    if (customer.name.trim().length >= 2 && isValidYemeniPhone(cp)) {
      setIsEditingProfile(false);
    }
  }, [customer.name, customer.phone]);

  const profilePhoneValid = isValidYemeniPhone(phone);
  const addressPhoneValid = isValidYemeniPhone(address.phone);

  const saveProfile = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2) {
      toast.error("يرجى كتابة الاسم الكامل.");
      return;
    }
    if (!profilePhoneValid) {
      toast.error("يرجى إدخال رقم جوال يمني صحيح مكون من 9 أرقام ويبدأ بـ 77 أو 73 أو 78 أو 71 أو 70.");
      return;
    }
    const cleanP = cleanYemeniPhone(phone);
    customer.saveProfile(name.trim(), cleanP);
    setIsEditingProfile(false);
    toast.success("تم حفظ معلومات حسابك بنجاح ✓");
  };

  const resetAddressForm = () => {
    setEditingAddressId(null);
    setShowAddressForm(false);
    setAddress({
      label: "المنزل",
      recipientName: customer.name || name,
      phone: cleanYemeniPhone(customer.phone || phone),
      city: "صنعاء",
      district: "",
      details: "",
      isDefault: customer.addresses.length === 0,
    });
  };

  const submitAddress = (event: FormEvent) => {
    event.preventDefault();
    if (!addressPhoneValid) {
      toast.error("يرجى إدخال رقم جوال يمني صحيح مكون من 9 أرقام ويبدأ بـ 77 أو 73 أو 78 أو 71 أو 70.");
      return;
    }
    if (!address.city.trim() || !address.district.trim()) {
      toast.error("يرجى اختيار منطقة التوصيل (المدينة والمنطقة والشارع).");
      return;
    }
    customer.saveAddress({
      ...address,
      phone: cleanYemeniPhone(address.phone),
      id: editingAddressId ?? undefined,
    });
    toast.success(editingAddressId ? "تم تحديث العنوان المحفوظ بنجاح ✓" : "تم حفظ العنوان الجديد بنجاح ✓");
    resetAddressForm();
  };

  const carrierName = getYemenCarrierName(cleanedCustomerPhone);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [isStandaloneApp, setIsStandaloneApp] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as any).standalone);
  });
  const [pwaInstallPrompt, setPwaInstallPrompt] = useState<any>(() => (typeof window !== "undefined" ? (window as any).__deferredPwaPrompt ?? null : null));
  const [pushPerm, setPushPerm] = useState(getPushPermissionState);

  useEffect(() => {
    const checkStandalone = () => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as any).standalone);
      setIsStandaloneApp(standalone);
      if (!standalone) {
        try { localStorage.removeItem("shahezo-pwa-installed-v1"); } catch {}
      }
    };
    checkStandalone();
    const onPromptReady = () => setPwaInstallPrompt((window as any).__deferredPwaPrompt ?? null);
    const onInstalled = () => { setIsStandaloneApp(true); setPwaInstallPrompt(null); };
    window.addEventListener("pwa-prompt-ready", onPromptReady);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("pwa-prompt-ready", onPromptReady);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const socialCfg = useMemo(() => {
    const defaults = {
      aboutTitle: "بوفية شهيزو – شهي ولذيذ",
      aboutText: "في بوفية شهيزو نحضّر لكم يومياً أشهى الشاورما، الفلافل الساخنة المقرمشة، والعصائر الطبيعية الطازجة بأجود المكونات وبأعلى معايير النظافة والطعم الأصيل مع توصيل سريع لباب منزلك.",
      whatsapp: "https://wa.me/967779542219",
      facebook: "https://facebook.com/shizo.ye",
      instagram: "https://instagram.com/shizo.ye",
      tiktok: "https://tiktok.com/@shizo.ye",
      phone: "779542219",
      whatsappEnabled: true,
      facebookEnabled: true,
      instagramEnabled: true,
      tiktokEnabled: true,
      phoneEnabled: true,
    };
    try {
      const raw = settings?.socialLinksConfig;
      if (!raw) return defaults;
      const p = JSON.parse(raw);
      return {
        aboutTitle: p.aboutTitle || defaults.aboutTitle,
        aboutText: p.aboutText || defaults.aboutText,
        whatsapp: p.whatsapp ?? defaults.whatsapp,
        facebook: p.facebook ?? defaults.facebook,
        instagram: p.instagram ?? defaults.instagram,
        tiktok: p.tiktok ?? defaults.tiktok,
        phone: p.phone ?? defaults.phone,
        whatsappEnabled: p.whatsappEnabled !== false,
        facebookEnabled: p.facebookEnabled !== false,
        instagramEnabled: p.instagramEnabled !== false,
        tiktokEnabled: p.tiktokEnabled !== false,
        phoneEnabled: p.phoneEnabled !== false,
      };
    } catch {
      return defaults;
    }
  }, [settings?.socialLinksConfig]);

  const normalizeWaHref = (val: string) => {
    const clean = val.trim();
    if (clean.startsWith("http")) return clean;
    const digits = clean.replace(/\\D+/g, "");
    if (!digits) return "https://wa.me/967779542219";
    return "https://wa.me/" + (digits.startsWith("967") ? digits : ("967" + digits));
  };

  return (
    <main className="page-shell inner-page" style={{ paddingTop: "10px", paddingBottom: "28px" }}>
      <div className="shahezo-acc-wrap shahezo-card-enter">
        <section className="shahezo-acc-card">
          <div className="shahezo-acc-hero">
            <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
              <span className="shahezo-acc-avatar">
                {(customer.name || name || "ش").trim().slice(0, 1)}
              </span>
              <div style={{ minWidth: 0, display: "grid", gap: "4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: "16.5px", fontWeight: 900, color: "#ffffff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {hasSavedProfile ? customer.name : "مرحباً بك في بوفية شهيزو"}
                  </strong>
                  <span className="shahezo-acc-vip-tag">✨ حسابي</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
                  <span dir="ltr" style={{ fontSize: "13px", color: "#fde8d7", fontWeight: 800, letterSpacing: "0.5px" }}>
                    {hasSavedProfile ? cleanedCustomerPhone : "احفظ اسمك ورقمك للطلب السريع"}
                  </span>
                  {hasSavedProfile && carrierName && (
                    <span className="shahezo-acc-vip-tag" style={{ background: "rgba(255,255,255,0.14)", color: "#ffffff" }}>
                      ✓ {carrierName}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {!isEditingProfile && (
              <button
                type="button"
                className="shahezo-acc-edit-btn"
                onClick={() => setIsEditingProfile(true)}
              >
                ✏️ تعديل
              </button>
            )}
          </div>

          {isEditingProfile && (
            <div style={{ padding: "15px 16px", borderBottom: "1px solid #f2e5da", background: "#fffdf9" }}>
              <form className="form-stack" onSubmit={saveProfile} style={{ gap: "10px" }}>
                <label>الاسم الكامل *
                  <input required minLength={2} maxLength={160} autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="أدخل اسمك الكامل..." />
                </label>
                <label>
                  <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>رقم الجوال اليمني (9 أرقام) *</span>
                    <small style={{ fontSize: "10.5px", fontWeight: 800, color: profilePhoneValid ? "#870210" : "#b43c2f" }}>
                      {profilePhoneValid ? ("✓ رقم صحيح (" + getYemenCarrierName(phone) + ")") : ("يبدأ بـ 77 أو 73 أو 78 أو 71 أو 70 (" + phone.length + "/9)")}
                    </small>
                  </span>
                  <input
                    required
                    type="tel"
                    inputMode="numeric"
                    maxLength={9}
                    dir="ltr"
                    value={phone}
                    onChange={event => setPhone(cleanYemeniPhone(event.target.value))}
                    placeholder="مثال: 770731619"
                    style={{ textAlign: "left", fontWeight: 800, fontSize: "15px", letterSpacing: "0.8px", borderColor: phone && !profilePhoneValid ? "#d9534f" : undefined }}
                  />
                </label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button type="submit" className="button button-primary" disabled={name.trim().length < 2 || !profilePhoneValid} style={{ flex: 1 }}>
                    <Check size={16} /> حفظ بياناتي
                  </button>
                  {hasSavedProfile && (
                    <button type="button" className="button button-quiet" onClick={() => { setName(customer.name); setPhone(cleanedCustomerPhone); setIsEditingProfile(false); }}>
                      إلغاء
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

          <div className="shahezo-acc-shortcuts">
            <Link href="/orders" className="shahezo-acc-tile">
              <span className="shahezo-acc-tile-icon">
                <Package size={19} />
                {customer.orders.length > 0 && <b className="shahezo-acc-tile-badge">{customer.orders.length}</b>}
              </span>
              <strong>طلباتي</strong>
              <small>تتبع الطلب</small>
            </Link>
            <Link href="/favorites" className="shahezo-acc-tile">
              <span className="shahezo-acc-tile-icon">
                <Heart size={19} />
                {favoriteIds.length > 0 && <b className="shahezo-acc-tile-badge">{favoriteIds.length}</b>}
              </span>
              <strong>المفضلة</strong>
              <small>وجباتي</small>
            </Link>
            <Link href="/products?offers=1" className="shahezo-acc-tile" style={{ background: "linear-gradient(180deg, #fffaf0 0%, #fdf9f4 100%)", borderColor: "#edd3aa" }}>
              <span className="shahezo-acc-tile-icon" style={{ background: "#fff3db", borderColor: "#f0cfa0", color: "#c95608" }}>
                <BadgePercent size={19} />
              </span>
              <strong>العروضات</strong>
              <small style={{ color: "#c95608" }}>توفير اليوم</small>
            </Link>
            <Link href="/cart" className="shahezo-acc-tile">
              <span className="shahezo-acc-tile-icon">
                <ShoppingCart size={19} />
                {cartCount > 0 && <b className="shahezo-acc-tile-badge">{cartCount}</b>}
              </span>
              <strong>السلة</strong>
              <small>{cartCount > 0 ? "إتمام الطلب" : "فارغة"}</small>
            </Link>
          </div>
        </section>

        <section className="shahezo-acc-card">
          <div className="shahezo-acc-sec-head">
            <div className="shahezo-acc-sec-title">
              <span className="shahezo-acc-sec-icon">
                <MapPin size={19} />
              </span>
              <div>
                <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 900, color: "#2b120f" }}>عناوين التوصيل المحفوظة ({customer.addresses.length})</h2>
                <small style={{ color: "#7a5e54", fontSize: "11px", fontWeight: 600 }}>يُختار عنوانك الافتراضي تلقائياً عند تأكيد الطلب</small>
              </div>
            </div>
            {!showAddressForm && (
              <button
                type="button"
                className="small-button selected"
                style={{ background: "#870210", color: "#ffffff", border: "none", borderRadius: "12px", padding: "7px 13px", fontWeight: 800, fontSize: "11.5px" }}
                onClick={() => {
                  setEditingAddressId(null);
                  setAddress({ label: "المنزل", recipientName: customer.name || name, phone: cleanedCustomerPhone || phone, city: "صنعاء", district: "", details: "", isDefault: customer.addresses.length === 0 });
                  setShowAddressForm(true);
                }}
              >
                <Plus size={14} /> إضافة عنوان
              </button>
            )}
          </div>

          <div style={{ padding: "14px 16px" }}>
            {!customer.addresses.length && !showAddressForm ? (
              <div style={{ textAlign: "center", padding: "20px 14px", borderRadius: "16px", background: "#fdf9f4", border: "1.5px dashed #dfcbbd" }}>
                <p style={{ margin: "0 0 11px", fontSize: "12px", color: "#6e564d", fontWeight: 700 }}>أضف عنوان توصيلك مرة واحدة ليتم اختياره تلقائياً في كل طلب قادم.</p>
                <button type="button" className="small-button selected" style={{ background: "#870210", color: "#ffffff", border: "none", borderRadius: "11px", padding: "8px 16px", fontWeight: 800 }} onClick={() => setShowAddressForm(true)}>
                  <Plus size={14} /> إضافة أول عنوان توصيل
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "10px" }}>
                {customer.addresses.map(item => (
                  <div
                    key={item.id}
                    className={"shahezo-acc-addr-item" + (item.isDefault ? " is-default" : "")}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
                        <strong style={{ fontSize: "14px", color: "#2b120f", fontWeight: 900 }}>📍 {item.label}</strong>
                        {item.isDefault ? (
                          <span className="shahezo-acc-badge-ok">✓ العنوان المعتمد للتوصيل</span>
                        ) : (
                          <button
                            type="button"
                            className="small-button"
                            style={{ fontSize: "10.5px", fontWeight: 800, padding: "2px 9px", minHeight: "24px", borderRadius: "99px", color: "#870210", borderColor: "#e6c7bc", background: "#fffaf6" }}
                            onClick={() => { customer.setDefaultAddress(item.id); toast.success("تم اعتماده كعنوان توصيل افتراضي ✓"); }}
                          >
                            اعتماد كافتراضي
                          </button>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <button
                          type="button"
                          className="small-button"
                          style={{ fontSize: "11px", fontWeight: 800, padding: "4px 10px", minHeight: "28px" }}
                          onClick={() => {
                            setEditingAddressId(item.id);
                            setAddress({
                              label: item.label,
                              recipientName: item.recipientName,
                              phone: cleanYemeniPhone(item.phone),
                              city: item.city,
                              district: item.district,
                              details: item.details,
                              isDefault: item.isDefault,
                            });
                            setShowAddressForm(true);
                          }}
                        >
                          ✏️ تعديل
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          style={{ width: "28px", height: "28px" }}
                          aria-label="حذف العنوان"
                          onClick={() => {
                            customer.removeAddress(item.id);
                            toast.success("حُذف العنوان من هذا الجهاز.");
                            if (editingAddressId === item.id) resetAddressForm();
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div style={{ fontSize: "12px", color: "#4e3830", fontWeight: 700, lineHeight: 1.55 }}>
                      {item.city} — {item.district}{item.details ? (" · " + item.details) : ""}
                    </div>
                    <div style={{ fontSize: "11.5px", color: "#7a5e54", fontWeight: 700 }}>
                      👤 المستلم: {item.recipientName} · <span dir="ltr" style={{ color: "#870210", fontWeight: 800 }}>{cleanYemeniPhone(item.phone)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showAddressForm && (
              <form className="form-stack" onSubmit={submitAddress} style={{ marginTop: customer.addresses.length ? "14px" : "0", paddingTop: customer.addresses.length ? "14px" : "0", borderTop: customer.addresses.length ? "1.5px dashed #e5d2c3" : "none", gap: "10px" }}>
                <strong style={{ fontSize: "13px", color: "#870210" }}>{editingAddressId ? "✏️ تعديل العنوان المحفوظ" : "➕ إضافة عنوان توصيل جديد"}</strong>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {["المنزل", "العمل", "منزل العائلة", "استراحة"].map(preset => (
                    <button key={preset} type="button" className={"small-button" + (address.label === preset ? " selected" : "")} style={{ minHeight: "28px", padding: "2px 10px", fontSize: "11px" }} onClick={() => setAddress({ ...address, label: preset })}>{preset}</button>
                  ))}
                </div>
                <div className="form-grid">
                  <label>تسمية العنوان *<input required maxLength={80} value={address.label} onChange={event => setAddress({ ...address, label: event.target.value })} placeholder="المنزل، العمل..." /></label>
                  <label>اسم المستلم *<input required minLength={2} maxLength={160} autoComplete="name" value={address.recipientName} onChange={event => setAddress({ ...address, recipientName: event.target.value })} /></label>
                  <label className="form-wide">
                    <span style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>رقم الجوال اليمني (9 أرقام) *</span>
                      <small style={{ fontSize: "10px", fontWeight: 800, color: addressPhoneValid ? "#870210" : "#b43c2f" }}>{address.phone.length}/9</small>
                    </span>
                    <input required type="tel" inputMode="numeric" maxLength={9} dir="ltr" value={address.phone} onChange={event => setAddress({ ...address, phone: cleanYemeniPhone(event.target.value) })} placeholder="77XXXXXXX" style={{ textAlign: "left", fontWeight: 800 }} />
                  </label>
                  {deliveryTree ? (
                    <div className="form-wide">
                      <ThreeStepLocationPicker
                        tree={deliveryTree}
                        city={address.city}
                        district={address.district}
                        phone={address.phone}
                        subtotal={0}
                        onChangeLocation={(nextCity, nextDist) => setAddress(curr => ({ ...curr, city: nextCity, district: nextDist }))}
                      />
                    </div>
                  ) : (
                    <>
                      <label>المدينة / المنطقة *<input required maxLength={100} value={address.city} onChange={event => setAddress({ ...address, city: event.target.value })} placeholder="صنعاء" /></label>
                      <label className="form-wide">الحي / الشارع *<input required maxLength={120} value={address.district} onChange={event => setAddress({ ...address, district: event.target.value })} placeholder="مثلاً: الرقاص، حدة، الأصبحي..." /></label>
                    </>
                  )}
                  <label className="form-wide">أقرب معلم للعنوان<textarea required rows={2} maxLength={1000} value={address.details} onChange={event => setAddress({ ...address, details: event.target.value })} placeholder="مثال: بجوار بنك الكريمي، أمام جامع..." /></label>
                  <label className="toggle-field form-wide"><input type="checkbox" checked={address.isDefault} onChange={event => setAddress({ ...address, isDefault: event.target.checked })} /> اجعل هذا العنوان هو الافتراضي عند الطلب</label>
                </div>
                <div className="address-form-actions" style={{ display: "flex", gap: "8px" }}>
                  <button type="submit" className="button button-primary" disabled={!addressPhoneValid}><Check size={16} /> {editingAddressId ? "حفظ تعديل العنوان" : "حفظ العنوان"}</button>
                  <button type="button" className="button button-quiet" onClick={resetAddressForm}>إلغاء</button>
                </div>
              </form>
            )}
          </div>
        </section>

        <section className="shahezo-acc-card">
          <button
            type="button"
            className="shahezo-acc-row-btn"
            onClick={async () => {
              const perm = getPushPermissionState();
              if (perm === "unsupported") { toast.info("متصفحك لا يدعم إشعارات الويب الفورية"); return; }
              if (perm === "denied") { toast.error("الإشعارات محظورة من إعدادات المتصفح — فعّلها من أيقونة القفل بالأعلى"); return; }
              const granted = perm === "granted" ? "granted" : await requestPushPermission();
              setPushPerm(granted);
              if (granted === "granted") {
                toast.success("🔔 إشعارات الطلبات الفورية مفعّلة بنجاح!");
              }
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "11px" }}>
              <span className="shahezo-acc-sec-icon">
                <BellRing size={18} />
              </span>
              <span style={{ display: "grid", gap: "1px" }}>
                <strong style={{ fontSize: "13.5px", fontWeight: 900, color: "#2b120f" }}>تفعيل إشعارات الطلبات الفورية</strong>
                <small style={{ fontSize: "11px", color: "#7a5e54", fontWeight: 600 }}>تنبيهات لحظية عند تجهيز طلبك وخروجه للتوصيل</small>
              </span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
              {pushPerm === "granted" ? (
                <span className="shahezo-acc-badge-ok">مفعّلة ✓</span>
              ) : (
                <span className="shahezo-acc-badge">تفعيل الآن</span>
              )}
              <ChevronLeft size={16} color="#8c766e" />
            </span>
          </button>

          {!isStandaloneApp && (
            <button
              type="button"
              className="shahezo-acc-row-btn"
              onClick={async () => {
                const activePrompt = pwaInstallPrompt || (window as any).__deferredPwaPrompt;
                if (activePrompt) {
                  try {
                    await activePrompt.prompt();
                    const choice = await activePrompt.userChoice;
                    if (choice.outcome === "accepted") {
                      setIsStandaloneApp(true);
                      setPwaInstallPrompt(null);
                      (window as any).__deferredPwaPrompt = null;
                      toast.success("📲 جاري تثبيت تطبيق شهيزو على هاتفك!");
                    }
                    return;
                  } catch {}
                }
                toast.info("اضغط على قائمة المتصفح (⋮) بالأعلى ثم اختر «إضافة إلى الشاشة الرئيسية» لتثبيت تطبيق شهيزو");
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "11px" }}>
                <span className="shahezo-acc-sec-icon" style={{ background: "#fff3db", borderColor: "#f0cfa0", color: "#c95608" }}>
                  <ShoppingBag size={18} />
                </span>
                <span style={{ display: "grid", gap: "1px" }}>
                  <strong style={{ fontSize: "13.5px", fontWeight: 900, color: "#2b120f" }}>تثبيت تطبيق شهيزو على هاتفك</strong>
                  <small style={{ fontSize: "11px", color: "#7a5e54", fontWeight: 600 }}>افتح المتجر بضغطة واحدة من شاشتك الرئيسية</small>
                </span>
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                <span className="shahezo-acc-badge" style={{ background: "#fff3db", borderColor: "#f0cfa0", color: "#9a3f04" }}>تثبيت ⬇</span>
                <ChevronLeft size={16} color="#8c766e" />
              </span>
            </button>
          )}

          <div>
            <button
              type="button"
              className="shahezo-acc-row-btn"
              onClick={() => setAboutOpen(v => !v)}
              style={{ background: aboutOpen ? "#fffaf5" : "#ffffff", borderBottom: 0 }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "11px" }}>
                <span className="shahezo-acc-sec-icon">
                  <Sparkles size={18} />
                </span>
                <span style={{ display: "grid", gap: "1px" }}>
                  <strong style={{ fontSize: "13.5px", fontWeight: 900, color: "#2b120f" }}>من نحن وحساباتنا الرسمية</strong>
                  <small style={{ fontSize: "11px", color: "#7a5e54", fontWeight: 600 }}>نبذة عن بوفية شهيزو وروابط التواصل المباشر</small>
                </span>
              </span>
              <ChevronDown size={17} color="#870210" style={{ transform: aboutOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
            </button>

            {aboutOpen && (
              <div style={{ padding: "15px 16px", background: "linear-gradient(180deg, #fffaf5 0%, #ffffff 100%)", borderTop: "1px solid #f2e5da", display: "grid", gap: "13px" }}>
                <div style={{ padding: "12px 14px", borderRadius: "15px", background: "#ffffff", border: "1px solid #ead8cc", display: "grid", gap: "6px" }}>
                  <strong style={{ fontSize: "14px", color: "#870210", fontWeight: 900 }}>🥙 {socialCfg.aboutTitle}</strong>
                  <p style={{ margin: 0, fontSize: "12px", lineHeight: 1.75, color: "#4e3830", fontWeight: 600 }}>{socialCfg.aboutText}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", paddingTop: "4px" }}>
                    <span className="shahezo-acc-badge">🥙 تحضير طازج يومياً</span>
                    <span className="shahezo-acc-badge">🛵 توصيل سريع وحار</span>
                    <span className="shahezo-acc-badge">💵 الدفع عند الاستلام</span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(58px, 1fr))", gap: "8px" }}>
                  {socialCfg.whatsappEnabled && socialCfg.whatsapp.trim() !== "" && (
                    <a href={normalizeWaHref(socialCfg.whatsapp)} target="_blank" rel="noreferrer" aria-label="واتساب" className="shahezo-social-btn" style={{ background: "#eafaf0", border: "1.5px solid #bfead0", color: "#128C7E" }}>
                      <MessageCircle size={20} />
                      <span>واتساب</span>
                    </a>
                  )}
                  {socialCfg.facebookEnabled && socialCfg.facebook.trim() !== "" && (
                    <a href={socialCfg.facebook} target="_blank" rel="noreferrer" aria-label="فيسبوك" className="shahezo-social-btn" style={{ background: "#eef4ff", border: "1.5px solid #c9dcff", color: "#1877F2" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.99 3.66 9.13 8.44 9.88v-6.99H7.9V12h2.54V9.8c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99C18.34 21.13 22 16.99 22 12z"/></svg>
                      <span>فيسبوك</span>
                    </a>
                  )}
                  {socialCfg.instagramEnabled && socialCfg.instagram.trim() !== "" && (
                    <a href={socialCfg.instagram} target="_blank" rel="noreferrer" aria-label="إنستغرام" className="shahezo-social-btn" style={{ background: "#fdf0f6", border: "1.5px solid #f7cde0", color: "#E1306C" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                      <span>إنستغرام</span>
                    </a>
                  )}
                  {socialCfg.tiktokEnabled && socialCfg.tiktok.trim() !== "" && (
                    <a href={socialCfg.tiktok} target="_blank" rel="noreferrer" aria-label="تيك توك" className="shahezo-social-btn" style={{ background: "#f4f4f5", border: "1.5px solid #d4d4d8", color: "#18181b" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.87a8.16 8.16 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.3z"/></svg>
                      <span>تيك توك</span>
                    </a>
                  )}
                  {socialCfg.phoneEnabled && socialCfg.phone.trim() !== "" && (
                    <a href={"tel:" + socialCfg.phone.replace(/\\s+/g, "")} aria-label="اتصال" className="shahezo-social-btn" style={{ background: "#fceee9", border: "1.5px solid #f2cfc6", color: "#870210" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                      <span>اتصال</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}"""

home = re.sub(
    r"function FavoritesPage\([\s\S]*?(?=\ntype AssistantProductLine)",
    lambda _: new_fav_orders_account_block + "\n",
    home,
    count=1
)

home = home.replace(
    'if (location === "/favorites") return <FavoritesPage />;',
    'if (location === "/favorites") return <FavoritesPage allProducts={data.products} />;'
)
home = home.replace(
    'if (location === "/account") return <AccountPage />;',
    'if (location === "/account") return <AccountPage settings={data.settings} />;'
)

for block_name, block_code in [("new_cart_block", new_cart_block), ("new_fav_orders_account_block", new_fav_orders_account_block)]:
    for tag in ["main", "section", "article", "aside", "form", "button", "label", "div", "span", "strong", "small", "a", "svg", "p", "h1", "h2"]:
        opens = len(re.findall(rf"<{tag}\b[^>]*?(?<!/)>", block_code))
        closes = len(re.findall(rf"</{tag}>", block_code))
        assert opens == closes, f"{block_name} mismatch for <{tag}>: opens={opens} != closes={closes}"

for fn in ["Header", "ShahezoWhatsAppBar", "BottomNav", "HomePage", "ProductListPage", "CategoriesPage", "ProductDetail", "CartPage", "CartRow", "Checkout", "FavoritesPage", "OrdersPage", "AccountPage", "AssistantPage", "GamifiedRewardBar"]:
    cnt = len(re.findall(rf"function\s+{fn}\b", home))
    assert cnt == 1, f"Expected 1 definition of {fn}, found {cnt}"

with open("client/src/pages/Home.tsx", "w", encoding="utf-8") as f:
    f.write(home)

print("✅ All 15 core components verified and AccountPage v12 applied cleanly!")
