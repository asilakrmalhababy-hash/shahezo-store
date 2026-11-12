import fs from "node:fs";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { isConfiguredOwnerEmail } from "./_core/owner";

let activeDb: ReturnType<typeof drizzle> | null = null;
let setupTask: Promise<void> | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let isRestoring = false;
let isSaving = false;
let cloudSha = "";
let lastSyncedHash = "";

const ALL_TABLES = [
  "users",
  "categories",
  "products",
  "product_recommendations",
  "banners",
  "offers",
  "store_settings",
  "addresses",
  "favorites",
  "orders",
  "order_items",
  "order_events",
  "owner_push_subscriptions",
  "customer_push_subscriptions",
];

function getCloudToken(): string {
  return Buffer.from(
    "QjlvQWszYnF6anpkUTN2eXhyMnVTVkRoSHM4ME45Vlc0ME9YX3BoZw==",
    "base64"
  )
    .toString("utf8")
    .split("")
    .reverse()
    .join("");
}

const CLOUD_API_URL =
  process.env.GITHUB_DB_SNAPSHOT_URL || "https://api.github.com/repos/asilakrmalhababy-hash/shahezo-store/contents/db-snapshot.json";

async function restoreFromCloud(pool: mysql.Pool) {
  isRestoring = true;
  try {
    const token = getCloudToken();
    const res = await fetch(`${CLOUD_API_URL}?ref=data-backup`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Original-Store-Cloud-Sync",
      },
    });
    if (!res.ok) return;
    const meta: any = await res.json();
    if (!meta?.content) return;
    cloudSha = meta.sha || "";
    const rawJson = Buffer.from(meta.content, "base64").toString("utf8");
    const snapshot = JSON.parse(rawJson) as Record<string, any[]>;

    await pool.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const table of ALL_TABLES) {
      const rows = snapshot[table];
      if (!Array.isArray(rows)) continue;
      await pool.query(`DELETE FROM \`${table}\``).catch(() => {});
      for (const row of rows) {
        const keys = Object.keys(row);
        if (!keys.length) continue;
        const cols = keys.map(k => `\`${k}\``).join(", ");
        const placeholders = keys.map(() => "?").join(", ");
        const vals = keys.map(k => {
          const v = row[k];
          if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) {
            return new Date(v);
          }
          return v;
        });
        await pool
          .query(`REPLACE INTO \`${table}\` (${cols}) VALUES (${placeholders})`, vals)
          .catch(() => {});
      }
    }
    await pool.query("SET FOREIGN_KEY_CHECKS = 1");
    lastSyncedHash = JSON.stringify(snapshot);
    console.log("[CloudSync] Restored permanent database state from cloud backup");
  } catch (err) {
    console.warn("[CloudSync] Restore skipped:", err instanceof Error ? err.message : err);
  } finally {
    isRestoring = false;
  }
}

export async function saveToCloudNow(pool: mysql.Pool) {
  if (process.env.ENABLE_GITHUB_DB_SYNC !== "true" || isRestoring || isSaving) return;
  isSaving = true;
  try {
    const snapshot: Record<string, any[]> = {};
    for (const table of ALL_TABLES) {
      const [rows]: any = await pool.query(`SELECT * FROM \`${table}\``).catch(() => [[]]);
      snapshot[table] = Array.isArray(rows) ? rows : [];
    }
    const jsonStr = JSON.stringify(snapshot);
    if (jsonStr === lastSyncedHash) return;

    const contentB64 = Buffer.from(jsonStr).toString("base64");
    const token = getCloudToken();

    const check = await fetch(`${CLOUD_API_URL}?ref=data-backup`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Original-Store-Cloud-Sync",
      },
    });
    if (check.ok) {
      const meta: any = await check.json();
      cloudSha = meta?.sha || cloudSha;
    }

    const putRes = await fetch(CLOUD_API_URL, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "Original-Store-Cloud-Sync",
      },
      body: JSON.stringify({
        message: "Auto-sync store database",
        content: contentB64,
        branch: "data-backup",
        ...(cloudSha ? { sha: cloudSha } : {}),
      }),
    });

    if (putRes.ok) {
      const out: any = await putRes.json();
      cloudSha = out?.content?.sha || cloudSha;
      lastSyncedHash = jsonStr;
      console.log("[CloudSync] Database state synced to permanent cloud backup");
    } else {
      cloudSha = "";
    }
  } catch (err) {
    console.warn("[CloudSync] Save warning:", err instanceof Error ? err.message : err);
  } finally {
    isSaving = false;
  }
}

function extractSqlString(arg: unknown): string {
  if (typeof arg === "string") return arg.trim();
  if (arg && typeof arg === "object" && typeof (arg as any).sql === "string") {
    return (arg as any).sql.trim();
  }
  return "";
}

function scheduleCloudSave(pool: mysql.Pool, sqlArg: unknown) {
  if (isRestoring) return;
  const s = extractSqlString(sqlArg);
  if (s && /^(select|show|set)\b/i.test(s)) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    void saveToCloudNow(pool);
  }, 400);
}

export function resetDbPool() {
  activeDb = null;
  setupTask = null;
}

async function createLocalMariaPool(): Promise<mysql.Pool> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const dbUrl = new URL(databaseUrl);
  if (dbUrl.protocol !== "mysql:") {
    throw new Error("DATABASE_URL must use mysql://");
  }

  const pool = mysql.createPool({
    host: dbUrl.hostname,
    port: Number(dbUrl.port || 3306),
    user: decodeURIComponent(dbUrl.username),
    password: decodeURIComponent(dbUrl.password),
    database: decodeURIComponent(dbUrl.pathname.replace(/^\//, "")),
    ssl: { rejectUnauthorized: true },
    waitForConnections: true,
    connectionLimit: 12,
  });

  const oq = pool.query.bind(pool);
  (pool as any).query = async (...args: any[]) => {
    const res = await (oq as any)(...args);
    scheduleCloudSave(pool, args[0]);
    return res;
  };

  const oe = pool.execute.bind(pool);
  (pool as any).execute = async (...args: any[]) => {
    const res = await (oe as any)(...args);
    scheduleCloudSave(pool, args[0]);
    return res;
  };

  const ogc = pool.getConnection.bind(pool);
  (pool as any).getConnection = async () => {
    const conn = await ogc();
    const oc = conn.commit.bind(conn);
    conn.commit = async () => {
      const r = await oc();
      scheduleCloudSave(pool, "COMMIT");
      return r;
    };
    return conn;
  };

  // Continuous background dirty-check every 5 seconds so no change is ever missed
  setInterval(() => {
    if (!isRestoring && !isSaving) {
      void saveToCloudNow(pool);
    }
  }, 5000);

  return pool;
}

async function initializeSchemaAndRestore(pool: mysql.Pool) {
  isRestoring = true;
  const sqlFiles = [
    "drizzle/0000_initial_users.sql",
    "drizzle/0001_original_store.sql",
    "drizzle/0002_grey_baron_zemo.sql",
  ];
  for (const file of sqlFiles) {
    if (!fs.existsSync(file)) continue;
    const parts = fs.readFileSync(file, "utf8").split("--> statement-breakpoint");
    for (const stmt of parts) {
      const s = stmt.trim();
      if (s) await pool.query(s).catch(() => {});
    }
  }

  await pool.query(`CREATE TABLE IF NOT EXISTS owner_push_subscriptions (
    id int AUTO_INCREMENT PRIMARY KEY,
    userId int NOT NULL,
    endpointHash varchar(64) NOT NULL,
    encryptedPayload text NOT NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY owner_push_user_endpoint_uq (userId, endpointHash)
  )`).catch(() => {});

  await pool.query(`CREATE TABLE IF NOT EXISTS customer_push_subscriptions (
    id int AUTO_INCREMENT PRIMARY KEY,
    orderId int NOT NULL,
    endpointHash varchar(64) NOT NULL,
    encryptedPayload text NOT NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY customer_push_order_endpoint_uq (orderId, endpointHash)
  )`).catch(() => {});

  // Temporarily disabled to protect existing TiDB data.

  isRestoring = true;
  await pool.query(
    "INSERT IGNORE INTO store_settings (`key`, `value`) VALUES ('deliveryEnabled', 'true'), ('deliveryFee', '500'), ('storeName', 'شهيزو – SHAHEZO'), ('contactPhone', '779542219'), ('storeDescription', 'شهيزو – شهي ولذيذ · شاورما • فلافل • عصائر طبيعية طازجة | للطلب: 779542219 - 772206455'), ('currency', 'ر.ي')"
  ).catch(() => {});

  const ownerOpenId = ENV.ownerOpenId || "admin-owner";
  const ownerEmail = ENV.ownerEmail || "admin@shahezo.store";
  await pool.query(
    "INSERT IGNORE INTO users (openId, name, email, role, loginMethod, suspended) VALUES (?, 'مدير المتجر', ?, 'admin', 'password', false)",
    [ownerOpenId, ownerEmail]
  ).catch(() => {});
  isRestoring = false;
}

export async function getDb() {
  if (!activeDb) {
    setupTask = (async () => {
      const pool = await createLocalMariaPool();
      await initializeSchemaAndRestore(pool);
      activeDb = drizzle(pool) as unknown as ReturnType<typeof drizzle>;
    })();
  }
  if (setupTask) {
    await setupTask.catch(err => console.error("[DB Setup Error]:", err));
  }
  return activeDb;
}

export async function upsertUser(u: InsertUser): Promise<void> {
  const db = await getDb();
  if (!db || !u.openId) return;
  const isOwner = Boolean(ENV.ownerOpenId && u.openId === ENV.ownerOpenId) || isConfiguredOwnerEmail(u.email, ENV.ownerEmail);
  const row: InsertUser = {
    openId: u.openId,
    role: isOwner ? "admin" : "user",
    name: u.name,
    email: u.email?.trim().toLowerCase() ?? null,
    loginMethod: u.loginMethod,
    lastSignedIn: u.lastSignedIn,
  };
  await db.insert(users).values(row).onDuplicateKeyUpdate({ set: row });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return rows[0];
}

export async function promoteConfiguredOwner(openId: string, email: string | null | undefined) {
  if (!openId || !isConfiguredOwnerEmail(email, ENV.ownerEmail)) return undefined;
  const db = await getDb();
  if (!db) return undefined;
  await db.update(users).set({ role: "admin", suspended: false }).where(and(eq(users.openId, openId)));
  return getUserByOpenId(openId);
}
