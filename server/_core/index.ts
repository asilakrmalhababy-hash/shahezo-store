import mysqlMonitor from "mysql2/promise";
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import { getDb } from "../db";
import { storeSettings } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

const HTTPS_PREFIX = ["ht", "tps", "://"].join("");
const HTTP_PREFIX = ["ht", "tp"].join("");

async function startServer() {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
  });
  const server = createServer(app);
  // === SHAHEZO_DB_STATUS_START ===
  app.get("/api/db-status", async (req: any, res: any) => {
    let tempConn: any = null;
    try {
      if (!process.env.DATABASE_URL) {
        return res.status(500).json({ ok: false, error: "DATABASE_URL غير مضبوط في Render" });
      }
      const u = new URL(process.env.DATABASE_URL);
      tempConn = await mysqlMonitor.createConnection({
        host: u.hostname,
        port: Number(u.port || 4000),
        user: decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
        database: u.pathname.replace(/^\//, "") || "shahezo",
        ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
        connectTimeout: 10000
      });
      const [sizeRows]: any = await tempConn.query(
        "SELECT table_name AS name, ROUND((data_length + index_length) / 1024 / 1024, 4) AS size_mb FROM information_schema.tables WHERE table_schema = DATABASE()"
      );
      const sizeMap: Record<string, number> = {};
      let totalMb = 0;
      if (Array.isArray(sizeRows)) {
        for (const r of sizeRows) {
          const tName = String(r.name || r.NAME || r.table_name || "").toLowerCase();
          const mb = Number(r.size_mb || r.SIZE_MB || 0);
          sizeMap[tName] = mb;
          totalMb += mb;
        }
      }
      const tableDefs = [
        { key: "categories", label: "الأقسام" },
        { key: "products", label: "المنتجات" },
        { key: "banners", label: "البنرات الإعلانية" },
        { key: "offers", label: "العروض" },
        { key: "orders", label: "الطلبات" },
        { key: "order_items", label: "أصناف الطلبات" },
        { key: "store_settings", label: "إعدادات البوفية" }
      ];
      const stats: any[] = [];
      for (const td of tableDefs) {
        try {
          const [cnt]: any = await tempConn.query("SELECT COUNT(*) AS c FROM " + td.key);
          stats.push({ table: td.key, label: td.label, rows: Number((cnt && cnt[0] && (cnt[0].c ?? cnt[0].C)) || 0), sizeMb: Number((sizeMap[td.key] || 0).toFixed(4)) });
        } catch (_e) {
          stats.push({ table: td.key, label: td.label, rows: 0, sizeMb: 0 });
        }
      }
      await tempConn.end(); tempConn = null;
      const maxMb = 5120, usedMb = Number(totalMb.toFixed(4)), remainMb = Number((maxMb - usedMb).toFixed(2)), usedPct = Number(((usedMb / maxMb) * 100).toFixed(4));
      if (req.query && req.query.json === "1") return res.json({ ok: true, usedMb, maxMb, remainMb, usedPct, stats });
      const rowsHtml = stats.map(s => `<tr><td style='padding:10px;border-bottom:1px solid rgba(232,108,18,0.2);font-weight:700;'>${s.label}</td><td style='padding:10px;border-bottom:1px solid rgba(232,108,18,0.2);text-align:center;color:#e86c12;font-weight:800;'>${s.rows}</td><td style='padding:10px;border-bottom:1px solid rgba(232,108,18,0.2);text-align:left;direction:ltr;'>${s.sizeMb} MB</td></tr>`).join("");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(`<!DOCTYPE html><html lang='ar' dir='rtl'><head><meta charset='utf-8'/><meta name='viewport' content='width=device-width,initial-scale=1'/><title>مراقبة قاعدة شهيزو</title><style>body{margin:0;padding:18px;background:#2b120f;color:#fff;font-family:system-ui,Tahoma,sans-serif;}.card{max-width:540px;margin:0 auto;background:linear-gradient(145deg,#870210,#4d0209);border:1.5px solid #e86c12;border-radius:20px;padding:20px;box-shadow:0 14px 36px rgba(0,0,0,0.45);}.badge{background:rgba(34,197,94,0.2);color:#4ade80;border:1px solid #4ade80;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:800;}table{width:100%;border-collapse:collapse;margin-top:14px;font-size:14px;}.btn{display:inline-block;margin-top:16px;background:#e86c12;color:#fff;text-decoration:none;font-weight:800;padding:10px 18px;border-radius:12px;font-size:14px;}</style></head><body><div class='card'><div style='display:flex;justify-content:space-between;align-items:center;'><h2 style='margin:0;color:#fde8d4;font-size:19px;'>🥙 قاعدة بيانات شهيزو</h2><span class='badge'>متصل 🟢</span></div><p style='margin:10px 0 4px;font-size:14px;'>المساحة المستهلكة: <strong style='color:#ffb366;'>${usedMb} MB</strong> من 5,120 MB (${usedPct}%)</p><table><thead><tr style='color:#ffb366;border-bottom:2px solid #e86c12;'><th style='text-align:right;padding:8px;'>الجدول</th><th style='text-align:center;padding:8px;'>العدد</th><th style='text-align:left;padding:8px;'>الحجم</th></tr></thead><tbody>${rowsHtml}</tbody></table><div style='display:flex;gap:10px;justify-content:center;'><a class='btn' href='/api/db-status'>🔄 تحديث</a><a class='btn' style='background:rgba(255,255,255,0.15);border:1px solid #e86c12;' href='/'>🏠 المتجر</a></div></div></body></html>`);
    } catch (err: any) {
      if (tempConn) try { await tempConn.end(); } catch (_e) {}
      return res.status(500).json({ ok: false, error: err?.message || "DB error" });
    }
  });
// === SHAHEZO_DB_STATUS_END ===
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok", ts: Date.now() }));
  if (!(globalThis as any).__keepAliveTimer) {
    (globalThis as any).__keepAliveTimer = setInterval(() => {
      const extUrl = process.env.RENDER_EXTERNAL_URL || (HTTPS_PREFIX + "original-store-xmyf.onrender.com");
      fetch(extUrl + "/api/health").catch(() => {});
    }, 10 * 60 * 1000);
  }

  // --- FAST_IMG_ROUTE_START ---
  const ALLOWED_IMG_MIMES = new Set(["image/webp", "image/png", "image/jpeg", "image/jpg", "image/gif", "image/avif"]);
  function isSafeExternalImageUrl(rawUrl: string): boolean {
    try {
      const u = new URL(rawUrl);
      if (u.protocol !== "https:") return false;
      const h = u.hostname.toLowerCase();
      if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || h === "[::1]") return false;
      if (/^(?:127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(h)) return false;
      return true;
    } catch {
      return false;
    }
  }
  app.get("/api/fast-img/:kind/:id", async (req, res) => {
    try {
      const kind = req.params.kind;
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) return res.status(404).end();
      const cacheMap: Map<string, { contentType: string; buf: Buffer }> =
        (globalThis as any).__fastImgCache || ((globalThis as any).__fastImgCache = new Map());
      const cacheKey = kind + ":" + id;
      let entry = cacheMap.get(cacheKey);
      if (!entry) {
        const db = await getDb();
        if (!db) return res.status(404).end();
        const { products, categories, banners } = await import("../../drizzle/schema");
        const table: any = kind === "product" ? products : kind === "category" ? categories : kind === "banner" ? banners : null;
        if (!table) return res.status(404).end();
        const rows = await db.select({ imageUrl: table.imageUrl }).from(table).where(eq(table.id, id)).limit(1);
        const raw = String(rows[0]?.imageUrl || "").trim();
        const m = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
        if (m) {
          const mime = m[1].toLowerCase();
          if (!ALLOWED_IMG_MIMES.has(mime)) return res.status(415).end();
          entry = { contentType: mime, buf: Buffer.from(m[2], "base64") };
          cacheMap.set(cacheKey, entry);
        } else if (raw.startsWith(HTTP_PREFIX)) {
          if (!isSafeExternalImageUrl(raw)) return res.status(403).end();
          const resp = await fetch(raw);
          if (!resp.ok) return res.status(404).end();
          const ct = (resp.headers.get("content-type") || "image/webp").split(";")[0].trim().toLowerCase();
          if (!ALLOWED_IMG_MIMES.has(ct)) return res.status(415).end();
          const ab = await resp.arrayBuffer();
          if (ab.byteLength > 8_500_000) return res.status(413).end();
          const buf = Buffer.from(ab);
          entry = { contentType: ct, buf };
          cacheMap.set(cacheKey, entry);
          const dataUrl = "data:" + ct + ";base64," + buf.toString("base64");
          void db.update(table).set({ imageUrl: dataUrl }).where(eq(table.id, id)).catch(() => {});
        } else if (raw.startsWith("/") && !raw.startsWith("//")) {
          return res.redirect(302, raw);
        } else {
          return res.status(404).end();
        }
      }
      res.set("Content-Type", entry.contentType);
      res.set("X-Content-Type-Options", "nosniff");
      res.set("Content-Security-Policy", "default-src 'none'; sandbox");
      res.set("Cache-Control", "public, max-age=0, must-revalidate");
      return res.send(entry.buf);
    } catch {
      return res.status(500).end();
    }
  });
  // --- FAST_IMG_ROUTE_END ---

  let cachedBrand: { name: string; icon: string; time: number } | null = null;
  const publicBrand = async () => {
    try {
      const g = globalThis as any;
      if (g.__fastHomeData?.settings) {
        const s = g.__fastHomeData.settings;
        const candidate = String(s.storeIconUrl || "");
        const icon = candidate.startsWith("/manus-storage/") || candidate.startsWith(HTTPS_PREFIX) || candidate.startsWith("data:image/") ? candidate : "";
        return { name: s.storeName || "شهيزو – SHAHEZO", icon };
      }
      if (cachedBrand && Date.now() - cachedBrand.time < 300000) {
        return { name: cachedBrand.name, icon: cachedBrand.icon };
      }
      const db = await getDb();
      if (!db) return { name: "شهيزو – SHAHEZO", icon: "" };
      const rows = await db.select({ key: storeSettings.key, value: storeSettings.value }).from(storeSettings).where(eq(storeSettings.key, "storeIconUrl")).limit(1);
      const nameRows = await db.select({ value: storeSettings.value }).from(storeSettings).where(eq(storeSettings.key, "storeName")).limit(1);
      const candidate = rows[0]?.value ?? "";
      const icon = candidate.startsWith("/manus-storage/") || candidate.startsWith(HTTPS_PREFIX) ? candidate : "";
      const name = (nameRows[0]?.value || "شهيزو – SHAHEZO").replace(new RegExp("أوريجنال|أورجنال|اوريجنال|ORIGINAL", "gi"), "شهيزو – SHAHEZO");
      cachedBrand = { name, icon, time: Date.now() };
      return { name, icon };
    } catch {
      return { name: "شهيزو – SHAHEZO", icon: "" };
    }
  };

  app.get("/api/app-manifest.webmanifest", async (_req, res) => {
    const brand = await publicBrand();
    const imagePath = brand.icon && !brand.icon.startsWith("data:") ? new URL(brand.icon, HTTPS_PREFIX + "app.invalid").pathname : "";
    const type = imagePath.endsWith(".png") ? "image/png" : imagePath.endsWith(".jpg") || imagePath.endsWith(".jpeg") ? "image/jpeg" : imagePath.endsWith(".webp") ? "image/webp" : "image/png";
    const icons = [
      { src: "/app-icon-192-v4.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icon-512-v4.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ];
    res.set("Cache-Control", "public, max-age=300").type("application/manifest+json").send(JSON.stringify({ id: "/", name: brand.name, short_name: "شهيزو", description: "متجر شهيزو – SHAHEZO", lang: "ar", dir: "rtl", start_url: "/", scope: "/", display: "standalone", background_color: "#fdf9f4", theme_color: "#870210", icons }));
  });

  app.get("/api/store-icon", async (_req, res) => {
    const brand = await publicBrand();
    const target = brand.icon && !brand.icon.startsWith("data:") ? brand.icon : "/app-icon-180-v4.png";
    res.set("Cache-Control", "public, max-age=300").redirect(302, target);
  });

  app.get("/api/platform/config.js", async (_req, res) => {
    const g = globalThis as any;
    if (!g.__fastHomeData && typeof g.__loadCatalogHome === "function") {
      try { await g.__loadCatalogHome(); } catch {}
    }
    const initialJson = g.__fastHomeData ? JSON.stringify(g.__fastHomeData).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029") : "null";
    const preloadScript = "window.__INITIAL_CATALOG__ = " + initialJson + ";";
    res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript() + "\n" + preloadScript);
  });

  registerOAuthRoutes(app);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  server.on("error", error => { console.error("Server failed:", error.message); process.exit(1); });
  server.listen(port, "0.0.0.0", () => console.log("Server listening on port " + port));
}

startServer().catch(error => { console.error(error); process.exit(1); });
