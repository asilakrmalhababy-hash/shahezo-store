import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

function applyRouteManifestHtml(html: string, url: string): string {
  const cleanPath = (url || "").split("?")[0];
  if (cleanPath === "/admin" || cleanPath.startsWith("/admin/")) {
    return html
      .replace('href="/manifest-v9.webmanifest"', 'href="/manifest-admin.webmanifest"')
      .replace('content="شهيزو"', 'content="إدارة شهيزو"')
      .replace('<title>شهيزو | بوفية ومطعم شهيزو – أشهى فلافل ساخنة وشاورما وعصائر طبيعية</title>', '<title>إدارة شهيزو – لوحة التحكم المستقلة</title>');
  }
  return html;
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = applyRouteManifestHtml(template, url);
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use(express.static(distPath));

  app.use("*", async (req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    try {
      let html = applyRouteManifestHtml(fs.readFileSync(indexPath, "utf-8"), req.originalUrl);
      if (!req.originalUrl.startsWith("/admin")) {
        const g = globalThis as any;
        let initialData = g.__fastHomeData;
        if (!initialData && typeof g.__loadCatalogHome === "function") {
          try { initialData = await g.__loadCatalogHome(); } catch {}
        }
        if (initialData && Array.isArray(initialData.products)) {
          const safeJson = JSON.stringify(initialData).replace(/</g, "\\u003c");
          html = html.replace("</head>", `<script>window.__SHAHEZO_INITIAL_HOME__=${safeJson};</script></head>`);
        }
      }
      res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).send(html);
    } catch {
      res.sendFile(indexPath);
    }
  });
}
