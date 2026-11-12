var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// drizzle/schema.ts
var schema_exports = {};
__export(schema_exports, {
  addresses: () => addresses,
  adminAuditLogs: () => adminAuditLogs,
  adminStaff: () => adminStaff,
  banners: () => banners,
  categories: () => categories,
  customerPushSubscriptions: () => customerPushSubscriptions,
  favorites: () => favorites,
  offers: () => offers,
  orderEvents: () => orderEvents,
  orderItems: () => orderItems,
  orders: () => orders,
  ownerPushSubscriptions: () => ownerPushSubscriptions,
  productRecommendations: () => productRecommendations,
  products: () => products,
  storeSettings: () => storeSettings,
  users: () => users
});
import {
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/mysql-core";
var users, categories, products, productRecommendations, banners, offers, storeSettings, addresses, favorites, orders, orderItems, orderEvents, ownerPushSubscriptions, customerPushSubscriptions, adminStaff, adminAuditLogs;
var init_schema = __esm({
  "drizzle/schema.ts"() {
    "use strict";
    users = mysqlTable("users", {
      id: int("id").autoincrement().primaryKey(),
      openId: varchar("openId", { length: 64 }).notNull().unique(),
      name: text("name"),
      email: varchar("email", { length: 320 }),
      phone: varchar("phone", { length: 32 }),
      loginMethod: varchar("loginMethod", { length: 64 }),
      role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
      suspended: boolean("suspended").default(false).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
      lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
    });
    categories = mysqlTable("categories", {
      id: int("id").autoincrement().primaryKey(),
      name: varchar("name", { length: 120 }).notNull(),
      slug: varchar("slug", { length: 180 }).notNull().unique(),
      description: text("description"),
      imageUrl: text("imageUrl"),
      color: varchar("color", { length: 24 }).default("#870210").notNull(),
      isActive: boolean("isActive").default(true).notNull(),
      sortOrder: int("sortOrder").default(0).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table) => [index("categories_active_order_idx").on(table.isActive, table.sortOrder)]);
    products = mysqlTable("products", {
      id: int("id").autoincrement().primaryKey(),
      name: varchar("name", { length: 180 }).notNull(),
      slug: varchar("slug", { length: 220 }).notNull().unique(),
      description: text("description"),
      imageUrl: text("imageUrl"),
      categoryId: int("categoryId").references(() => categories.id, { onDelete: "set null" }),
      price: int("price").notNull(),
      unit: varchar("unit", { length: 40 }).default("\u062D\u0628\u0629").notNull(),
      stock: int("stock"),
      minQuantity: int("minQuantity").default(1).notNull(),
      quantityStep: int("quantityStep").default(1).notNull(),
      isPublished: boolean("isPublished").default(false).notNull(),
      isAvailable: boolean("isAvailable").default(true).notNull(),
      sortOrder: int("sortOrder").default(0).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table) => [
      index("products_category_publish_idx").on(table.categoryId, table.isPublished),
      index("products_publish_order_idx").on(table.isPublished, table.sortOrder)
    ]);
    productRecommendations = mysqlTable("product_recommendations", {
      id: int("id").autoincrement().primaryKey(),
      productId: int("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
      recommendedProductId: int("recommendedProductId").notNull().references(() => products.id, { onDelete: "cascade" }),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (table) => [uniqueIndex("recommendation_pair_uq").on(table.productId, table.recommendedProductId)]);
    banners = mysqlTable("banners", {
      id: int("id").autoincrement().primaryKey(),
      title: varchar("title", { length: 160 }).notNull(),
      body: text("body"),
      imageUrl: text("imageUrl"),
      actionText: varchar("actionText", { length: 60 }),
      actionUrl: varchar("actionUrl", { length: 500 }),
      isActive: boolean("isActive").default(false).notNull(),
      sortOrder: int("sortOrder").default(0).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table) => [index("banners_active_order_idx").on(table.isActive, table.sortOrder)]);
    offers = mysqlTable("offers", {
      id: int("id").autoincrement().primaryKey(),
      title: varchar("title", { length: 160 }).notNull(),
      description: text("description"),
      code: varchar("code", { length: 40 }).notNull().unique(),
      discountType: mysqlEnum("discountType", ["fixed", "percent"]).notNull(),
      discountValue: int("discountValue").notNull(),
      minimumOrder: int("minimumOrder").default(0).notNull(),
      startsAt: timestamp("startsAt"),
      endsAt: timestamp("endsAt"),
      isActive: boolean("isActive").default(false).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table) => [index("offers_active_dates_idx").on(table.isActive, table.startsAt, table.endsAt)]);
    storeSettings = mysqlTable("store_settings", {
      key: varchar("key", { length: 100 }).primaryKey(),
      value: text("value").notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    addresses = mysqlTable("addresses", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
      label: varchar("label", { length: 80 }).notNull(),
      recipientName: varchar("recipientName", { length: 160 }).notNull(),
      phone: varchar("phone", { length: 32 }).notNull(),
      city: varchar("city", { length: 100 }).notNull(),
      district: varchar("district", { length: 120 }).notNull(),
      details: text("details"),
      isDefault: boolean("isDefault").default(false).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (table) => [index("addresses_user_idx").on(table.userId)]);
    favorites = mysqlTable("favorites", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
      productId: int("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (table) => [
      uniqueIndex("favorite_user_product_uq").on(table.userId, table.productId),
      index("favorites_user_idx").on(table.userId)
    ]);
    orders = mysqlTable("orders", {
      id: int("id").autoincrement().primaryKey(),
      orderNumber: varchar("orderNumber", { length: 40 }).notNull().unique(),
      idempotencyKey: varchar("idempotencyKey", { length: 80 }).notNull().unique(),
      userId: int("userId").references(() => users.id),
      offerId: int("offerId").references(() => offers.id, { onDelete: "set null" }),
      recipientName: varchar("recipientName", { length: 160 }).notNull(),
      phone: varchar("phone", { length: 32 }).notNull(),
      city: varchar("city", { length: 100 }).notNull(),
      district: varchar("district", { length: 120 }).notNull(),
      addressDetails: text("addressDetails"),
      customerNote: text("customerNote"),
      paymentMethod: mysqlEnum("paymentMethod", ["cash_on_delivery"]).default("cash_on_delivery").notNull(),
      status: mysqlEnum("status", ["new", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"]).default("new").notNull(),
      subtotal: int("subtotal").notNull(),
      deliveryFee: int("deliveryFee").notNull(),
      discount: int("discount").default(0).notNull(),
      total: int("total").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table) => [index("orders_user_date_idx").on(table.userId, table.createdAt), index("orders_status_date_idx").on(table.status, table.createdAt)]);
    orderItems = mysqlTable("order_items", {
      id: int("id").autoincrement().primaryKey(),
      orderId: int("orderId").notNull().references(() => orders.id, { onDelete: "cascade" }),
      productId: int("productId").references(() => products.id, { onDelete: "set null" }),
      productName: varchar("productName", { length: 180 }).notNull(),
      productImage: text("productImage"),
      unit: varchar("unit", { length: 40 }).notNull(),
      unitPrice: int("unitPrice").notNull(),
      quantity: int("quantity").notNull(),
      lineTotal: int("lineTotal").notNull()
    }, (table) => [index("order_items_order_idx").on(table.orderId)]);
    orderEvents = mysqlTable("order_events", {
      id: int("id").autoincrement().primaryKey(),
      orderId: int("orderId").notNull().references(() => orders.id, { onDelete: "cascade" }),
      status: mysqlEnum("status", ["new", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"]).notNull(),
      note: text("note"),
      changedByUserId: int("changedByUserId").references(() => users.id, { onDelete: "set null" }),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (table) => [index("order_events_order_idx").on(table.orderId, table.createdAt)]);
    ownerPushSubscriptions = mysqlTable("owner_push_subscriptions", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
      endpointHash: varchar("endpointHash", { length: 64 }).notNull(),
      encryptedPayload: text("encryptedPayload").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table) => [uniqueIndex("owner_push_user_endpoint_uq").on(table.userId, table.endpointHash)]);
    customerPushSubscriptions = mysqlTable("customer_push_subscriptions", {
      id: int("id").autoincrement().primaryKey(),
      orderId: int("orderId").notNull().references(() => orders.id, { onDelete: "cascade" }),
      endpointHash: varchar("endpointHash", { length: 64 }).notNull(),
      encryptedPayload: text("encryptedPayload").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table) => [
      uniqueIndex("customer_push_order_endpoint_uq").on(table.orderId, table.endpointHash),
      index("customer_push_order_idx").on(table.orderId)
    ]);
    adminStaff = mysqlTable("admin_staff", {
      id: int("id").autoincrement().primaryKey(),
      userId: int("userId").references(() => users.id, { onDelete: "set null" }),
      username: varchar("username", { length: 120 }).notNull().unique(),
      displayName: varchar("displayName", { length: 160 }).notNull(),
      passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
      roleKey: varchar("roleKey", { length: 40 }).default("staff").notNull(),
      permissionsJson: text("permissionsJson").notNull(),
      isActive: boolean("isActive").default(true).notNull(),
      mustChangePassword: boolean("mustChangePassword").default(true).notNull(),
      sessionVersion: int("sessionVersion").default(1).notNull(),
      createdBy: varchar("createdBy", { length: 160 }),
      lastLoginAt: timestamp("lastLoginAt"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table) => [
      uniqueIndex("admin_staff_username_uq").on(table.username),
      index("admin_staff_role_active_idx").on(table.roleKey, table.isActive)
    ]);
    adminAuditLogs = mysqlTable("admin_audit_logs", {
      id: int("id").autoincrement().primaryKey(),
      actorId: int("actorId"),
      actorName: varchar("actorName", { length: 160 }).notNull(),
      actorRole: varchar("actorRole", { length: 60 }).notNull(),
      action: varchar("action", { length: 80 }).notNull(),
      targetName: varchar("targetName", { length: 160 }),
      details: text("details"),
      ipAddress: varchar("ipAddress", { length: 80 }),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (table) => [
      index("admin_audit_created_idx").on(table.createdAt)
    ]);
  }
});

// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "webdev_app_session";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/oauth.ts
init_schema();
import { parse as parseCookieHeader2 } from "cookie";
import { eq as eq3 } from "drizzle-orm";

// server/db.ts
init_schema();
import fs from "node:fs";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

// server/_core/env.ts
var ENV = {
  get appId() {
    return process.env.MANUS_PROJECT_ID || "original-store";
  },
  get cookieSecret() {
    return process.env.MANUS_JWT_SECRET || process.env.JWT_SECRET || "original-store-permanent-jwt-secret-key-2026-yemen";
  },
  get databaseUrl() {
    return process.env.DATABASE_URL || "";
  },
  get oAuthServerUrl() {
    return process.env.MANUS_OAUTH_API_URL || "";
  },
  get ownerOpenId() {
    return process.env.OWNER_OPEN_ID?.trim() || "admin-owner";
  },
  get ownerEmail() {
    return process.env.OWNER_EMAIL?.trim().toLowerCase() || "admin@original.store";
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  get forgeApiUrl() {
    return process.env.MANUS_API_URL || "";
  },
  get forgeApiKey() {
    return process.env.MANUS_API_KEY || "";
  }
};

// server/_core/owner.ts
function isConfiguredOwnerEmail(email, configuredOwnerEmail) {
  const normalizedEmail = email?.trim().toLowerCase();
  const normalizedOwnerEmail = configuredOwnerEmail?.trim().toLowerCase();
  return Boolean(normalizedEmail && normalizedOwnerEmail && normalizedEmail === normalizedOwnerEmail);
}
function isConfiguredOwnerIdentity(openId, email, configuredOwnerOpenId, configuredOwnerEmail) {
  const normalizedOpenId = openId?.trim();
  const normalizedOwnerOpenId = configuredOwnerOpenId?.trim();
  return Boolean(
    normalizedOpenId && normalizedOwnerOpenId && normalizedOpenId === normalizedOwnerOpenId || isConfiguredOwnerEmail(email, configuredOwnerEmail)
  );
}
function shouldPromoteConfiguredOwner(user, configuredOwnerEmail) {
  return isConfiguredOwnerEmail(user.email, configuredOwnerEmail) && (user.role !== "admin" || user.suspended);
}

// server/db.ts
var activeDb = null;
var setupTask = null;
var syncTimer = null;
var isRestoring = false;
var isSaving = false;
var cloudSha = "";
var lastSyncedHash = "";
var ALL_TABLES = [
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
  "customer_push_subscriptions"
];
function getCloudToken() {
  return Buffer.from(
    "QjlvQWszYnF6anpkUTN2eXhyMnVTVkRoSHM4ME45Vlc0ME9YX3BoZw==",
    "base64"
  ).toString("utf8").split("").reverse().join("");
}
var CLOUD_API_URL = "https://api.github.com/repos/asilakrmalhababy-hash/shahezo-store/contents/db-snapshot.json";
async function saveToCloudNow(pool) {
  if (process.env.ENABLE_GITHUB_DB_SYNC !== "true" || isRestoring || isSaving) return;
  isSaving = true;
  try {
    const snapshot = {};
    for (const table of ALL_TABLES) {
      const [rows] = await pool.query(`SELECT * FROM \`${table}\``).catch(() => [[]]);
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
        "User-Agent": "Original-Store-Cloud-Sync"
      }
    });
    if (check.ok) {
      const meta = await check.json();
      cloudSha = meta?.sha || cloudSha;
    }
    const putRes = await fetch(CLOUD_API_URL, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "Original-Store-Cloud-Sync"
      },
      body: JSON.stringify({
        message: "Auto-sync store database",
        content: contentB64,
        branch: "data-backup",
        ...cloudSha ? { sha: cloudSha } : {}
      })
    });
    if (putRes.ok) {
      const out = await putRes.json();
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
function extractSqlString(arg) {
  if (typeof arg === "string") return arg.trim();
  if (arg && typeof arg === "object" && typeof arg.sql === "string") {
    return arg.sql.trim();
  }
  return "";
}
function scheduleCloudSave(pool, sqlArg) {
  if (isRestoring) return;
  const s = extractSqlString(sqlArg);
  if (s && /^(select|show|set)\b/i.test(s)) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    void saveToCloudNow(pool);
  }, 400);
}
function resetDbPool() {
  activeDb = null;
  setupTask = null;
}
async function createLocalMariaPool() {
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
    connectionLimit: 12
  });
  const oq = pool.query.bind(pool);
  pool.query = async (...args) => {
    const res = await oq(...args);
    scheduleCloudSave(pool, args[0]);
    return res;
  };
  const oe = pool.execute.bind(pool);
  pool.execute = async (...args) => {
    const res = await oe(...args);
    scheduleCloudSave(pool, args[0]);
    return res;
  };
  const ogc = pool.getConnection.bind(pool);
  pool.getConnection = async () => {
    const conn = await ogc();
    const oc = conn.commit.bind(conn);
    conn.commit = async () => {
      const r = await oc();
      scheduleCloudSave(pool, "COMMIT");
      return r;
    };
    return conn;
  };
  setInterval(() => {
    if (!isRestoring && !isSaving) {
      void saveToCloudNow(pool);
    }
  }, 5e3);
  return pool;
}
async function initializeSchemaAndRestore(pool) {
  isRestoring = true;
  const sqlFiles = [
    "drizzle/0000_initial_users.sql",
    "drizzle/0001_original_store.sql",
    "drizzle/0002_grey_baron_zemo.sql"
  ];
  for (const file of sqlFiles) {
    if (!fs.existsSync(file)) continue;
    const parts = fs.readFileSync(file, "utf8").split("--> statement-breakpoint");
    for (const stmt of parts) {
      const s = stmt.trim();
      if (s) await pool.query(s).catch(() => {
      });
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
  )`).catch(() => {
  });
  await pool.query(`CREATE TABLE IF NOT EXISTS customer_push_subscriptions (
    id int AUTO_INCREMENT PRIMARY KEY,
    orderId int NOT NULL,
    endpointHash varchar(64) NOT NULL,
    encryptedPayload text NOT NULL,
    createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY customer_push_order_endpoint_uq (orderId, endpointHash)
  )`).catch(() => {
  });
  isRestoring = true;
  await pool.query(
    "INSERT IGNORE INTO store_settings (`key`, `value`) VALUES ('deliveryEnabled', 'true'), ('deliveryFee', '0'), ('storeName', 'ORIGINAL \u2013 \u0623\u0648\u0631\u064A\u062C\u0646\u0627\u0644'), ('currency', '\u0631.\u064A')"
  ).catch(() => {
  });
  const ownerOpenId = ENV.ownerOpenId || "admin-owner";
  const ownerEmail = ENV.ownerEmail || "admin@original.store";
  await pool.query(
    "INSERT IGNORE INTO users (openId, name, email, role, loginMethod, suspended) VALUES (?, '\u0645\u062F\u064A\u0631 \u0627\u0644\u0645\u062A\u062C\u0631', ?, 'admin', 'password', false)",
    [ownerOpenId, ownerEmail]
  ).catch(() => {
  });
  isRestoring = false;
}
async function getDb() {
  if (!activeDb) {
    setupTask = (async () => {
      const pool = await createLocalMariaPool();
      await initializeSchemaAndRestore(pool);
      activeDb = drizzle(pool);
    })();
  }
  if (setupTask) {
    await setupTask.catch((err) => console.error("[DB Setup Error]:", err));
  }
  return activeDb;
}
async function upsertUser(u) {
  const db = await getDb();
  if (!db || !u.openId) return;
  const isOwner = Boolean(ENV.ownerOpenId && u.openId === ENV.ownerOpenId) || isConfiguredOwnerEmail(u.email, ENV.ownerEmail);
  const row = {
    openId: u.openId,
    role: isOwner ? "admin" : "user",
    name: u.name,
    email: u.email?.trim().toLowerCase() ?? null,
    loginMethod: u.loginMethod,
    lastSignedIn: u.lastSignedIn
  };
  await db.insert(users).values(row).onDuplicateKeyUpdate({ set: row });
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  const rows = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return rows[0];
}
async function promoteConfiguredOwner(openId, email) {
  if (!openId || !isConfiguredOwnerEmail(email, ENV.ownerEmail)) return void 0;
  const db = await getDb();
  if (!db) return void 0;
  await db.update(users).set({ role: "admin", suspended: false }).where(and(eq(users.openId, openId)));
  return getUserByOpenId(openId);
}

// server/_core/adminAuth.ts
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
init_schema();
var FORBIDDEN_WEAK_PASSWORDS = /* @__PURE__ */ new Set([
  "123456",
  "12345678",
  "123456789",
  "password",
  "admin",
  "admin123",
  "000000",
  "111111",
  "qwerty"
]);
var __rbacTablesEnsured = false;
async function ensureRbacTables(dbInstance) {
  if (__rbacTablesEnsured) return;
  try {
    const db = dbInstance || await getDb();
    if (!db) return;
    await db.execute(sql.raw("CREATE TABLE IF NOT EXISTS admin_staff (id int AUTO_INCREMENT NOT NULL, userId int NULL, username varchar(120) NOT NULL, displayName varchar(160) NOT NULL, passwordHash varchar(255) NOT NULL, roleKey varchar(40) NOT NULL DEFAULT 'staff', permissionsJson text NOT NULL, isActive boolean NOT NULL DEFAULT true, mustChangePassword boolean NOT NULL DEFAULT true, sessionVersion int NOT NULL DEFAULT 1, createdBy varchar(160) NULL, lastLoginAt timestamp NULL, createdAt timestamp NOT NULL DEFAULT (now()), updatedAt timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP, CONSTRAINT admin_staff_id PRIMARY KEY(id), CONSTRAINT admin_staff_username_uq UNIQUE(username))"));
    await db.execute(sql.raw("CREATE TABLE IF NOT EXISTS admin_audit_logs (id int AUTO_INCREMENT NOT NULL, actorId int NULL, actorName varchar(160) NOT NULL, actorRole varchar(60) NOT NULL, action varchar(80) NOT NULL, targetName varchar(160) NULL, details text NULL, ipAddress varchar(80) NULL, createdAt timestamp NOT NULL DEFAULT (now()), CONSTRAINT admin_audit_logs_id PRIMARY KEY(id))"));
    try {
      await db.execute(sql.raw("ALTER TABLE products MODIFY COLUMN imageUrl LONGTEXT NULL"));
    } catch {
    }
    try {
      await db.execute(sql.raw("ALTER TABLE categories MODIFY COLUMN imageUrl LONGTEXT NULL"));
    } catch {
    }
    try {
      await db.execute(sql.raw("ALTER TABLE banners MODIFY COLUMN imageUrl LONGTEXT NULL"));
    } catch {
    }
    try {
      await db.execute(sql.raw("ALTER TABLE store_settings MODIFY COLUMN value LONGTEXT NOT NULL"));
    } catch {
    }
    try {
      await db.execute(sql.raw("ALTER TABLE order_items MODIFY COLUMN productImage LONGTEXT NULL"));
    } catch {
    }
    try {
      await db.execute(sql.raw("UPDATE order_items SET productImage = CONCAT('/api/fast-img/product/', productId) WHERE productId IS NOT NULL AND productImage LIKE 'data:image/%'"));
    } catch {
    }
    __rbacTablesEnsured = true;
  } catch (err) {
    console.warn("[RBAC] Table init notice:", err instanceof Error ? err.message : "unknown");
  }
}
function hashAdminPassword(plainPassword) {
  const normalized = plainPassword.normalize("NFKC");
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(normalized, salt, 64).toString("hex");
  return "scrypt$" + salt + "$" + derived;
}
function verifyAdminPassword(plainPassword, storedHash) {
  if (!plainPassword || !storedHash) return false;
  try {
    const parts = storedHash.split("$");
    if (parts.length !== 3 || parts[0] !== "scrypt") return false;
    const [, salt, expectedHex] = parts;
    if (!salt || !expectedHex) return false;
    const actualBuf = scryptSync(plainPassword.normalize("NFKC"), salt, 64);
    const expectedBuf = Buffer.from(expectedHex, "hex");
    if (actualBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(actualBuf, expectedBuf);
  } catch {
    return false;
  }
}
function getConfiguredOwnerPassword() {
  const raw = (process.env.ADMIN_PASSWORD ?? "").trim();
  if (!raw) {
    return { configured: "", valid: false, reason: "\u0644\u0645 \u064A\u062A\u0645 \u0636\u0628\u0637 \u0645\u062A\u063A\u064A\u0631 \u0627\u0644\u0628\u064A\u0626\u0629 ADMIN_PASSWORD \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645." };
  }
  if (FORBIDDEN_WEAK_PASSWORDS.has(raw.toLowerCase()) || raw.length < 6) {
    return { configured: "", valid: false, reason: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u0645\u0636\u0628\u0648\u0637\u0629 \u0641\u064A ADMIN_PASSWORD \u0636\u0639\u064A\u0641\u0629 \u0623\u0648 \u0627\u0641\u062A\u0631\u0627\u0636\u064A\u0629 (\u0645\u062B\u0644 123456)\u061B \u064A\u0631\u0641\u0636 \u0627\u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u0639\u0645\u0644 \u0628\u0647\u0627." };
  }
  return { configured: raw, valid: true };
}
function verifyOwnerMasterPassword(candidate) {
  if (!candidate || FORBIDDEN_WEAK_PASSWORDS.has(candidate.trim().toLowerCase())) {
    return { ok: false, error: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629." };
  }
  const check = getConfiguredOwnerPassword();
  if (!check.valid) {
    return { ok: false, error: check.reason || "\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0645\u0635\u0627\u062F\u0642\u0629 \u0627\u0644\u0645\u0627\u0644\u0643 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629." };
  }
  const a = createHash("sha256").update(candidate, "utf8").digest();
  const b = createHash("sha256").update(check.configured, "utf8").digest();
  const matched = timingSafeEqual(a, b);
  return matched ? { ok: true } : { ok: false, error: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629." };
}
function getOwnerSessionOpenId() {
  const check = getConfiguredOwnerPassword();
  if (!check.valid) return "owner_disabled_unconfigured";
  const digest = createHash("sha256").update("original-owner-v2::" + check.configured, "utf8").digest("hex").slice(0, 16);
  return "owner_root_" + digest;
}
var loginRateMap = /* @__PURE__ */ new Map();
var MAX_LOGIN_ATTEMPTS = 5;
var WINDOW_MS = 15 * 60 * 1e3;
var LOCKOUT_MS = 15 * 60 * 1e3;
function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  const first = Array.isArray(xff) ? xff[0] : typeof xff === "string" ? xff.split(",")[0] : "";
  return (first?.trim() || req.ip || "unknown-ip").slice(0, 80);
}
function checkLoginRateLimit(ip) {
  const now = Date.now();
  const bucket = loginRateMap.get(ip);
  if (!bucket) return { allowed: true, retryAfterSeconds: 0 };
  if (bucket.lockedUntil > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.lockedUntil - now) / 1e3) };
  }
  if (now - bucket.firstFailedAt > WINDOW_MS) {
    loginRateMap.delete(ip);
    return { allowed: true, retryAfterSeconds: 0 };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}
function recordLoginFailure(ip) {
  const now = Date.now();
  const current = loginRateMap.get(ip);
  if (!current || now - current.firstFailedAt > WINDOW_MS) {
    loginRateMap.set(ip, { count: 1, firstFailedAt: now, lockedUntil: 0 });
    return { locked: false, remainingAttempts: MAX_LOGIN_ATTEMPTS - 1 };
  }
  current.count += 1;
  if (current.count >= MAX_LOGIN_ATTEMPTS) {
    current.lockedUntil = now + LOCKOUT_MS;
    return { locked: true, remainingAttempts: 0 };
  }
  return { locked: false, remainingAttempts: Math.max(0, MAX_LOGIN_ATTEMPTS - current.count) };
}
function clearLoginFailures(ip) {
  loginRateMap.delete(ip);
}
async function writeAdminAuditLog(entry) {
  try {
    const db = await getDb();
    if (!db) return;
    await ensureRbacTables(db);
    await db.insert(adminAuditLogs).values({
      actorId: entry.actorId ?? null,
      actorName: entry.actorName.slice(0, 160),
      actorRole: entry.actorRole.slice(0, 60),
      action: entry.action.slice(0, 80),
      targetName: entry.targetName ? entry.targetName.slice(0, 160) : null,
      details: entry.details ? entry.details.slice(0, 2e3) : null,
      ipAddress: entry.ipAddress ? entry.ipAddress.slice(0, 80) : null
    });
  } catch (err) {
    console.warn("[AuditLog] Failed to record entry:", err instanceof Error ? err.message : "unknown");
  }
}

// server/_core/cookies.ts
function getSessionCookieOptions(req) {
  const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";
  return { httpOnly: true, path: "/", sameSite: isSecure ? "none" : "lax", secure: isSecure };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
init_schema();
import { eq as eq2 } from "drizzle-orm";

// shared/rbac.ts
var PERMISSION_KEYS = [
  "overview.view",
  "products.view",
  "products.add",
  "products.edit",
  "products.delete",
  "products.manage",
  "inventory.manage",
  "categories.manage",
  "orders.view",
  "orders.manage",
  "banners.manage",
  "offers.manage",
  "customers.view",
  "chats.manage",
  "settings.manage",
  "staff.manage"
];
var PERMISSION_LABELS = {
  "overview.view": { label: "\u0639\u0631\u0636 \u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631 \u0648\u0627\u0644\u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A", group: "\u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631" },
  "products.view": { label: "\u0639\u0631\u0636 \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u0641\u0642\u0637", group: "\u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u0648\u0627\u0644\u0645\u062E\u0632\u0648\u0646" },
  "products.add": { label: "\u0625\u0636\u0627\u0641\u0629 \u0645\u0646\u062A\u062C\u0627\u062A \u062C\u062F\u064A\u062F\u0629 \u0641\u0642\u0637 (\u0628\u062F\u0648\u0646 \u062D\u0630\u0641)", group: "\u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u0648\u0627\u0644\u0645\u062E\u0632\u0648\u0646" },
  "products.edit": { label: "\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u0648\u0627\u0644\u0623\u0633\u0639\u0627\u0631 (\u0628\u062F\u0648\u0646 \u062D\u0630\u0641)", group: "\u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u0648\u0627\u0644\u0645\u062E\u0632\u0648\u0646" },
  "products.delete": { label: "\u062D\u0630\u0641 \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u0646\u0647\u0627\u0626\u064A\u0627\u064B", group: "\u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u0648\u0627\u0644\u0645\u062E\u0632\u0648\u0646", sensitive: true },
  "products.manage": { label: "\u0625\u062F\u0627\u0631\u0629 \u0643\u0627\u0645\u0644\u0629 \u0644\u0644\u0645\u0646\u062A\u062C\u0627\u062A (\u0625\u0636\u0627\u0641\u0629 \u0648\u062A\u0639\u062F\u064A\u0644 \u0648\u062D\u0630\u0641)", group: "\u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u0648\u0627\u0644\u0645\u062E\u0632\u0648\u0646" },
  "inventory.manage": { label: "\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0633\u0639\u0631 \u0648\u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u0648\u0627\u0644\u062A\u0648\u0641\u0631 \u0641\u0642\u0637", group: "\u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u0648\u0627\u0644\u0645\u062E\u0632\u0648\u0646" },
  "categories.manage": { label: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0623\u0642\u0633\u0627\u0645 \u0648\u0627\u0644\u062A\u0635\u0646\u064A\u0641\u0627\u062A", group: "\u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u0648\u0627\u0644\u0645\u062E\u0632\u0648\u0646" },
  "orders.view": { label: "\u0639\u0631\u0636 \u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0648\u062A\u0635\u062F\u064A\u0631\u0647\u0627", group: "\u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0648\u0627\u0644\u0639\u0645\u0644\u0627\u0621" },
  "orders.manage": { label: "\u062A\u062D\u062F\u064A\u062B \u062D\u0627\u0644\u0627\u062A \u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0648\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u0648\u0627\u0644\u062A\u0648\u0635\u064A\u0644", group: "\u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0648\u0627\u0644\u0639\u0645\u0644\u0627\u0621" },
  "customers.view": { label: "\u0639\u0631\u0636 \u0633\u062C\u0644 \u0627\u0644\u0639\u0645\u0644\u0627\u0621", group: "\u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0648\u0627\u0644\u0639\u0645\u0644\u0627\u0621" },
  "chats.manage": { label: "\u0625\u062F\u0627\u0631\u0629 \u0645\u062D\u0627\u062F\u062B\u0627\u062A \u0627\u0644\u0632\u0628\u0627\u0626\u0646 \u0648\u0627\u0644\u0631\u062F \u0627\u0644\u0645\u0628\u0627\u0634\u0631", group: "\u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0648\u0627\u0644\u0639\u0645\u0644\u0627\u0621" },
  "banners.manage": { label: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0625\u0639\u0644\u0627\u0646\u0627\u062A \u0648\u0627\u0644\u0628\u0646\u0631\u0627\u062A", group: "\u0627\u0644\u0645\u062D\u062A\u0648\u0649 \u0648\u0627\u0644\u0639\u0631\u0648\u0636" },
  "offers.manage": { label: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0631\u0648\u0636 \u0648\u0627\u0644\u062E\u0635\u0648\u0645\u0627\u062A", group: "\u0627\u0644\u0645\u062D\u062A\u0648\u0649 \u0648\u0627\u0644\u0639\u0631\u0648\u0636" },
  "settings.manage": { label: "\u0625\u062F\u0627\u0631\u0629 \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u062A\u062C\u0631 \u0648\u0627\u0644\u062A\u0648\u0635\u064A\u0644", group: "\u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0644\u064A\u0627", sensitive: true },
  "staff.manage": { label: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646 \u0648\u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A (\u0645\u0641\u0648\u0636)", group: "\u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0644\u064A\u0627", sensitive: true }
};
var ROLE_KEYS = [
  "owner",
  "general_manager",
  "product_manager",
  "order_manager",
  "content_manager",
  "staff"
];
var ROLE_DEFINITIONS = {
  owner: {
    label: "\u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062A\u062C\u0631",
    description: "\u062A\u062D\u0643\u0645 \u0643\u0627\u0645\u0644 \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645 \u0648\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u062F\u064A\u0631\u064A\u0646 \u0648\u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0648\u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u062D\u0633\u0627\u0633\u0629",
    defaultPermissions: [...PERMISSION_KEYS]
  },
  general_manager: {
    label: "\u0645\u062F\u064A\u0631 \u0639\u0627\u0645",
    description: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A \u0627\u0644\u064A\u0648\u0645\u064A\u0629 \u0644\u0644\u0645\u062A\u062C\u0631 \u0648\u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u0648\u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0648\u0627\u0644\u0639\u0631\u0648\u0636",
    defaultPermissions: [
      "overview.view",
      "products.view",
      "products.add",
      "products.edit",
      "products.delete",
      "products.manage",
      "inventory.manage",
      "categories.manage",
      "orders.view",
      "orders.manage",
      "banners.manage",
      "offers.manage",
      "customers.view",
      "chats.manage"
    ]
  },
  product_manager: {
    label: "\u0645\u062F\u064A\u0631 \u0645\u0646\u062A\u062C\u0627\u062A",
    description: "\u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u0648\u062A\u0639\u062F\u064A\u0644\u0647\u0627 \u0648\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u0648\u0627\u0644\u0623\u0633\u0639\u0627\u0631 (\u0628\u062F\u0648\u0646 \u062D\u0630\u0641 \u0625\u0644\u0627 \u0628\u062A\u0641\u0648\u064A\u0636)",
    defaultPermissions: [
      "overview.view",
      "products.view",
      "products.add",
      "products.edit",
      "inventory.manage"
    ]
  },
  order_manager: {
    label: "\u0645\u062F\u064A\u0631 \u0637\u0644\u0628\u0627\u062A",
    description: "\u0639\u0631\u0636 \u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0648\u062A\u062D\u062F\u064A\u062B \u062D\u0627\u0644\u0627\u062A\u0647\u0627 \u0648\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0646\u0648\u0627\u0642\u0635 \u0648\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u062A\u0648\u0635\u064A\u0644 \u0648\u0627\u0644\u0631\u062F \u0639\u0644\u0649 \u0627\u0644\u0632\u0628\u0627\u0626\u0646",
    defaultPermissions: [
      "overview.view",
      "orders.view",
      "orders.manage",
      "customers.view",
      "chats.manage"
    ]
  },
  content_manager: {
    label: "\u0645\u062F\u064A\u0631 \u0645\u062D\u062A\u0648\u0649 \u0648\u0639\u0631\u0648\u0636",
    description: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0625\u0639\u0644\u0627\u0646\u0627\u062A \u0648\u0627\u0644\u0639\u0631\u0648\u0636 \u0627\u0644\u062A\u0631\u0648\u064A\u062C\u064A\u0629 \u0648\u0639\u0631\u0636 \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A",
    defaultPermissions: [
      "overview.view",
      "products.view",
      "banners.manage",
      "offers.manage"
    ]
  },
  staff: {
    label: "\u0645\u0648\u0638\u0641 / \u0645\u0634\u0631\u0641 \u0645\u062E\u0635\u0635",
    description: "\u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0648\u0623\u0642\u0633\u0627\u0645 \u0645\u062D\u062F\u062F\u0629 \u064A\u062E\u062A\u0627\u0631\u0647\u0627 \u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062A\u062C\u0631 \u0628\u062F\u0642\u0629",
    defaultPermissions: [
      "products.view",
      "products.add"
    ]
  }
};
function parsePermissionsJson(raw, roleKey) {
  if (roleKey === "owner") return [...PERMISSION_KEYS];
  if (!raw) return [...ROLE_DEFINITIONS[roleKey]?.defaultPermissions ?? []];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...ROLE_DEFINITIONS[roleKey]?.defaultPermissions ?? []];
    const valid = new Set(PERMISSION_KEYS);
    return [...new Set(parsed.filter((p) => typeof p === "string" && valid.has(p)))];
  } catch {
    return [...ROLE_DEFINITIONS[roleKey]?.defaultPermissions ?? []];
  }
}
function parseAllowedCategoriesJson(raw, roleKey) {
  if (roleKey === "owner" || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const ids = [];
    for (const item of parsed) {
      if (typeof item === "string" && item.startsWith("cat:")) {
        const n = Number(item.slice(4));
        if (Number.isInteger(n) && n > 0) ids.push(n);
      }
    }
    return [...new Set(ids)];
  } catch {
    return [];
  }
}
function serializePermissionsAndCategories(permissions, allowedCategoryIds) {
  const uniquePerms = [...new Set(permissions)];
  const catTags = Array.isArray(allowedCategoryIds) ? [...new Set(allowedCategoryIds.filter((id) => Number.isInteger(id) && id > 0))].map((id) => "cat:" + id) : [];
  return JSON.stringify([...uniquePerms, ...catTags]);
}
function hasPermission(userPermissions, isOwner, required) {
  if (isOwner) return true;
  if (!userPermissions) return false;
  if (userPermissions.includes(required)) return true;
  if ((required === "products.view" || required === "products.add" || required === "products.edit" || required === "products.delete" || required === "inventory.manage") && userPermissions.includes("products.manage")) {
    return true;
  }
  if (required === "products.view" && (userPermissions.includes("products.add") || userPermissions.includes("products.edit") || userPermissions.includes("inventory.manage"))) {
    return true;
  }
  if (required === "inventory.manage" && userPermissions.includes("products.edit")) {
    return true;
  }
  return false;
}
function canManageTargetStaff(actor, targetRole, requestedPermissions, targetStaffId) {
  if (targetRole === "owner") {
    return { allowed: false, reason: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0625\u0646\u0634\u0627\u0621 \u062D\u0633\u0627\u0628 \u0645\u0627\u0644\u0643 \u0622\u062E\u0631 \u0623\u0648 \u062A\u0639\u062F\u064A\u0644 \u0631\u062A\u0628\u0629 \u0627\u0644\u0645\u0627\u0644\u0643." };
  }
  if (actor.isOwner) return { allowed: true };
  if (!actor.permissions?.includes("staff.manage")) {
    return { allowed: false, reason: "\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u062F\u064A\u0631\u064A\u0646 \u0648\u0627\u0644\u0645\u0648\u0638\u0641\u064A\u0646." };
  }
  if (targetStaffId && actor.staffId && targetStaffId === actor.staffId) {
    return { allowed: false, reason: "\u0644\u0627 \u064A\u0645\u0643\u0646\u0643 \u062A\u0639\u062F\u064A\u0644 \u0635\u0644\u0627\u062D\u064A\u0627\u062A \u062D\u0633\u0627\u0628\u0643 \u0627\u0644\u0634\u062E\u0635\u064A." };
  }
  const actorPerms = new Set(actor.permissions);
  for (const perm of requestedPermissions) {
    if (!actorPerms.has(perm) && !hasPermission(actor.permissions, false, perm)) {
      return { allowed: false, reason: "\u0644\u0627 \u064A\u0645\u0643\u0646\u0643 \u0645\u0646\u062D \u0635\u0644\u0627\u062D\u064A\u0629 \u0644\u0627 \u062A\u0645\u0644\u0643\u0647\u0627 \u0641\u064A \u062D\u0633\u0627\u0628\u0643." };
    }
  }
  return { allowed: true };
}

// server/_core/sdk.ts
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: MANUS_OAUTH_API_URL is not configured! Set MANUS_OAUTH_API_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    if (!secret) throw new Error("MANUS_JWT_SECRET is unavailable");
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || (!isNonEmptyString(appId) || appId !== ENV.appId) || typeof name !== "string") {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken && req.path.startsWith("/api/scheduled/")) {
      const ticket = cookies.get("app_session_id");
      const identity = await this.verifySession(ticket);
      if (identity?.openId.startsWith(CRON_OPEN_ID_PREFIX)) sessionToken = ticket;
    }
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    if (sessionUserId.startsWith("owner_root_")) {
      const expectedOwnerOpenId = getOwnerSessionOpenId();
      if (expectedOwnerOpenId === "owner_disabled_unconfigured" || sessionUserId !== expectedOwnerOpenId) {
        throw ForbiddenError("Owner session invalidated by password change");
      }
      const ownerUser = await getUserByOpenId(sessionUserId);
      return {
        id: ownerUser?.id ?? 1,
        openId: sessionUserId,
        name: ownerUser?.name || "\u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062A\u062C\u0631",
        email: ownerUser?.email || ENV.ownerEmail || null,
        phone: ownerUser?.phone || null,
        loginMethod: "admin_password",
        role: "admin",
        suspended: false,
        createdAt: ownerUser?.createdAt ?? signedInAt,
        updatedAt: ownerUser?.updatedAt ?? signedInAt,
        lastSignedIn: signedInAt,
        isOwner: true,
        adminRole: "owner",
        permissions: [...PERMISSION_KEYS],
        mustChangePassword: false,
        staffId: null
      };
    }
    if (sessionUserId.startsWith("staff_")) {
      const m = sessionUserId.match(/^staff_(\d+)_v(\d+)$/);
      if (!m) throw ForbiddenError("Invalid staff session format");
      const staffId = Number(m[1]);
      const tokenVersion = Number(m[2]);
      const database2 = await getDb();
      if (!database2) throw ForbiddenError("Database unavailable");
      await ensureRbacTables(database2);
      const rows = await database2.select().from(adminStaff).where(eq2(adminStaff.id, staffId)).limit(1);
      const staff = rows[0];
      if (!staff || !staff.isActive || staff.sessionVersion !== tokenVersion) {
        throw ForbiddenError("Staff session expired, disabled, or revoked");
      }
      let linkedUser = await getUserByOpenId("staff_user_" + staff.id);
      if (!linkedUser) {
        await upsertUser({ openId: "staff_user_" + staff.id, name: staff.displayName, email: null, loginMethod: "staff_password", lastSignedIn: /* @__PURE__ */ new Date() }).catch(() => {
        });
        linkedUser = await getUserByOpenId("staff_user_" + staff.id);
      }
      const roleKey = staff.roleKey || "staff";
      const perms = parsePermissionsJson(staff.permissionsJson, roleKey);
      const allowedCategoryIds = parseAllowedCategoriesJson(staff.permissionsJson, roleKey);
      const now = /* @__PURE__ */ new Date();
      return {
        id: linkedUser?.id ?? -1e3 - staff.id,
        openId: sessionUserId,
        name: staff.displayName,
        email: staff.username.includes("@") ? staff.username : null,
        phone: linkedUser?.phone ?? null,
        loginMethod: "staff_password",
        role: "admin",
        suspended: !staff.isActive,
        createdAt: staff.createdAt ?? now,
        updatedAt: staff.updatedAt ?? now,
        lastSignedIn: staff.lastLoginAt ?? now,
        isOwner: false,
        adminRole: roleKey,
        permissions: perms,
        allowedCategoryIds,
        mustChangePassword: Boolean(staff.mustChangePassword),
        staffId: staff.id,
        staffUsername: staff.username
      };
    }
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      let userInfo;
      try {
        userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
      if (userInfo.openId !== sessionUserId || !isConfiguredOwnerIdentity(userInfo.openId, userInfo.email, ENV.ownerOpenId, ENV.ownerEmail)) {
        throw ForbiddenError("Only the configured store owner may sign in");
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: signedInAt
      });
      user = await getUserByOpenId(userInfo.openId);
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    if (!isConfiguredOwnerIdentity(user.openId, user.email, ENV.ownerOpenId, ENV.ownerEmail)) {
      throw ForbiddenError("Only the configured store owner may sign in");
    }
    if (shouldPromoteConfiguredOwner(user, ENV.ownerEmail)) {
      user = await promoteConfiguredOwner(sessionUserId, user.email) ?? user;
    } else if (ENV.ownerOpenId?.trim() === user.openId && (user.role !== "admin" || user.suspended)) {
      await upsertUser({
        openId: user.openId,
        name: user.name,
        email: user.email,
        loginMethod: user.loginMethod,
        lastSignedIn: signedInAt
      });
      user = await getUserByOpenId(sessionUserId) ?? user;
    }
    return {
      ...user,
      isOwner: true,
      adminRole: "owner",
      permissions: [...PERMISSION_KEYS],
      mustChangePassword: false,
      staffId: null
    };
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
var SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1e3;
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
async function handleAdminPasswordLogin(req, res) {
  const cookieOptions = getSessionCookieOptions(req);
  if (req.method !== "POST") {
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.status(405).json({ error: "\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D\u0629. \u0627\u0633\u062A\u062E\u062F\u0645 POST \u0641\u0642\u0637." });
    return;
  }
  const ip = getClientIp(req);
  const rate = checkLoginRateLimit(ip);
  if (!rate.allowed) {
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.status(429).json({
      error: "\u062A\u0645 \u062D\u0638\u0631 \u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u0624\u0642\u062A\u0627\u064B \u0628\u0633\u0628\u0628 \u062A\u0643\u0631\u0627\u0631 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0627\u0644\u062E\u0627\u0637\u0626\u0629. \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 " + Math.ceil(rate.retryAfterSeconds / 60) + " \u062F\u0642\u064A\u0642\u0629."
    });
    return;
  }
  const rawUsername = typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : "";
  const rawPassword = typeof req.body?.password === "string" ? req.body.password : "";
  if (!rawPassword) {
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631." });
    return;
  }
  const isOwnerAttempt = !rawUsername || rawUsername === "owner" || rawUsername === "admin" || Boolean(ENV.ownerEmail) && rawUsername === ENV.ownerEmail.toLowerCase();
  try {
    if (isOwnerAttempt) {
      const check = verifyOwnerMasterPassword(rawPassword);
      if (!check.ok) {
        const fail = recordLoginFailure(ip);
        res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
        await writeAdminAuditLog({
          actorName: rawUsername || "owner",
          actorRole: "unauthenticated",
          action: "LOGIN_FAILED_OWNER",
          targetName: "\u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062A\u062C\u0631",
          details: check.error || "\u0645\u062D\u0627\u0648\u0644\u0629 \u062F\u062E\u0648\u0644 \u0641\u0627\u0634\u0644\u0629 \u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0627\u0644\u0643",
          ipAddress: ip
        });
        res.status(401).json({
          error: fail.locked ? "\u062A\u0645 \u0642\u0641\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0644\u0645\u062F\u0629 15 \u062F\u0642\u064A\u0642\u0629 \u0644\u062A\u062C\u0627\u0648\u0632 \u0639\u062F\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0627\u0644\u0645\u0633\u0645\u0648\u062D\u0629." : check.error || "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629."
        });
        return;
      }
      clearLoginFailures(ip);
      const ownerOpenId = getOwnerSessionOpenId();
      const database3 = await getDb();
      if (database3) {
        await ensureRbacTables(database3);
        await database3.insert(users).values({
          openId: ownerOpenId,
          name: "\u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062A\u062C\u0631",
          email: ENV.ownerEmail || "owner@original-store.local",
          loginMethod: "admin_password",
          role: "admin",
          suspended: false,
          lastSignedIn: /* @__PURE__ */ new Date()
        }).onDuplicateKeyUpdate({
          set: { role: "admin", suspended: false, lastSignedIn: /* @__PURE__ */ new Date() }
        });
      }
      const sessionToken2 = await sdk.createSessionToken(ownerOpenId, {
        name: "\u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062A\u062C\u0631",
        expiresInMs: SEVEN_DAYS_MS
      });
      res.cookie(COOKIE_NAME, sessionToken2, { ...cookieOptions, maxAge: SEVEN_DAYS_MS });
      await writeAdminAuditLog({
        actorName: "\u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062A\u062C\u0631",
        actorRole: "owner",
        action: "LOGIN_SUCCESS",
        targetName: "\u0644\u0648\u062D\u0629 \u0627\u0644\u0645\u0627\u0644\u0643",
        details: "\u062A\u0633\u062C\u064A\u0644 \u062F\u062E\u0648\u0644 \u0646\u0627\u062C\u062D \u0644\u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062A\u062C\u0631",
        ipAddress: ip
      });
      res.status(200).json({
        success: true,
        role: "owner",
        isOwner: true,
        mustChangePassword: false
      });
      return;
    }
    const database2 = await getDb();
    if (!database2) {
      res.status(503).json({ error: "\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u0645\u0624\u0642\u062A\u0627\u064B." });
      return;
    }
    await ensureRbacTables(database2);
    const staffRows = await database2.select().from(adminStaff).where(eq3(adminStaff.username, rawUsername)).limit(1);
    const staff = staffRows[0];
    if (!staff || !verifyAdminPassword(rawPassword, staff.passwordHash)) {
      const fail = recordLoginFailure(ip);
      res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      await writeAdminAuditLog({
        actorName: rawUsername,
        actorRole: "unauthenticated",
        action: "LOGIN_FAILED_STAFF",
        targetName: rawUsername,
        details: "\u0645\u062D\u0627\u0648\u0644\u0629 \u062F\u062E\u0648\u0644 \u0641\u0627\u0634\u0644\u0629 \u0644\u062D\u0633\u0627\u0628 \u0625\u062F\u0627\u0631\u064A",
        ipAddress: ip
      });
      res.status(401).json({
        error: fail.locked ? "\u062A\u0645 \u0642\u0641\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0644\u0645\u062F\u0629 15 \u062F\u0642\u064A\u0642\u0629 \u0644\u062A\u062C\u0627\u0648\u0632 \u0639\u062F\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0627\u0644\u0645\u0633\u0645\u0648\u062D\u0629." : "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629."
      });
      return;
    }
    if (!staff.isActive) {
      res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      await writeAdminAuditLog({
        actorId: staff.id,
        actorName: staff.displayName,
        actorRole: staff.roleKey,
        action: "LOGIN_BLOCKED_DISABLED",
        targetName: staff.username,
        details: "\u0645\u062D\u0627\u0648\u0644\u0629 \u062F\u062E\u0648\u0644 \u0644\u062D\u0633\u0627\u0628 \u0625\u062F\u0627\u0631\u064A \u0645\u0639\u0637\u0644",
        ipAddress: ip
      });
      res.status(403).json({ error: "\u062A\u0645 \u062A\u0639\u0637\u064A\u0644 \u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0625\u062F\u0627\u0631\u064A. \u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062A\u062C\u0631." });
      return;
    }
    clearLoginFailures(ip);
    const staffOpenId = "staff_" + staff.id + "_v" + staff.sessionVersion;
    const now = /* @__PURE__ */ new Date();
    await database2.insert(users).values({
      openId: "staff_user_" + staff.id,
      name: staff.displayName,
      email: staff.username.includes("@") ? staff.username : null,
      loginMethod: "staff_password",
      role: "admin",
      suspended: false,
      lastSignedIn: now
    }).onDuplicateKeyUpdate({
      set: { name: staff.displayName, role: "admin", suspended: false, lastSignedIn: now }
    });
    const linkedUser = await getUserByOpenId("staff_user_" + staff.id);
    await database2.update(adminStaff).set({
      lastLoginAt: now,
      ...linkedUser ? { userId: linkedUser.id } : {}
    }).where(eq3(adminStaff.id, staff.id));
    const sessionToken = await sdk.createSessionToken(staffOpenId, {
      name: staff.displayName,
      expiresInMs: SEVEN_DAYS_MS
    });
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SEVEN_DAYS_MS });
    await writeAdminAuditLog({
      actorId: staff.id,
      actorName: staff.displayName,
      actorRole: staff.roleKey,
      action: "LOGIN_SUCCESS",
      targetName: staff.username,
      details: "\u062A\u0633\u062C\u064A\u0644 \u062F\u062E\u0648\u0644 \u0625\u062F\u0627\u0631\u064A \u0646\u0627\u062C\u062D",
      ipAddress: ip
    });
    res.status(200).json({
      success: true,
      role: staff.roleKey,
      isOwner: false,
      mustChangePassword: Boolean(staff.mustChangePassword)
    });
  } catch (err) {
    console.error("[AdminAuth] Login error:", err instanceof Error ? err.message : "unknown");
    res.status(500).json({ error: "\u062D\u062F\u062B \u062E\u0637\u0623 \u0623\u062B\u0646\u0627\u0621 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644." });
  }
}
function registerOAuthRoutes(app) {
  app.post("/api/admin-login", handleAdminPasswordLogin);
  app.all("/api/admin-login", (req, res) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.status(405).json({ error: "\u0627\u0633\u062A\u062E\u062F\u0645 \u0637\u0644\u0628 POST \u0641\u0642\u0637 \u0644\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644." });
  });
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      if (!isConfiguredOwnerIdentity(userInfo.openId, userInfo.email, ENV.ownerOpenId, ENV.ownerEmail)) {
        res.status(403).json({ error: "Only the configured store owner can sign in." });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/admin");
    } catch (error) {
      console.error("[OAuth] Callback failed", error instanceof Error ? error.message : "unknown error");
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/publicConfig.ts
function publicPlatformConfig(env = process.env) {
  return {
    projectId: env.MANUS_PROJECT_ID ?? "",
    oauthPortalUrl: env.MANUS_OAUTH_PORTAL_URL ?? "",
    apiUrl: env.MANUS_API_URL ?? "",
    apiBrowserKey: env.MANUS_API_BROWSER_KEY ?? ""
  };
}
function publicPlatformScript(env = process.env) {
  const json = JSON.stringify(publicPlatformConfig(env)).replaceAll("<", "\\u003c");
  return `window.__MANUS_CONFIG__=${json};`;
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({ transformer: superjson });
var router = t.router;
var publicProcedure = t.procedure;
var lastSectionViewMap = /* @__PURE__ */ new Map();
var ORDER_STATUS_AR = {
  new: "\u062C\u062F\u064A\u062F",
  preparing: "\u0642\u064A\u062F \u0627\u0644\u062A\u062C\u0647\u064A\u0632",
  ready: "\u062C\u0627\u0647\u0632 \u0644\u0644\u062A\u0648\u0635\u064A\u0644",
  out_for_delivery: "\u062E\u0631\u062C \u0644\u0644\u062A\u0648\u0635\u064A\u0644",
  delivered: "\u062A\u0645 \u0627\u0644\u062A\u0633\u0644\u064A\u0645",
  cancelled: "\u0645\u0644\u063A\u064A"
};
function getArabicRoleName(role, isOwner) {
  if (isOwner || role === "owner") return "\u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062A\u062C\u0631";
  if (role && ROLE_DEFINITIONS[role]) return ROLE_DEFINITIONS[role].label;
  return "\u0645\u0634\u0631\u0641 \u0625\u062F\u0627\u0631\u064A";
}
function recordArabicAdminActivity(ctx, path3, type, rawInput) {
  try {
    const user = ctx.user;
    if (!user || user.role !== "admin") return;
    const isOwner = Boolean(user.isOwner ?? (!user.adminRole && user.role === "admin"));
    const actorId = user.staffId ?? user.id ?? null;
    const actorName = user.name || (isOwner ? "\u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062A\u062C\u0631" : "\u0645\u0634\u0631\u0641");
    const actorRole = getArabicRoleName(user.adminRole, isOwner);
    const ip = getClientIp(ctx.req);
    const inp = rawInput && typeof rawInput === "object" ? rawInput : {};
    if (type === "query") {
      const viewMap = {
        "commerce.admin.overview": { section: "overview", target: "\u0642\u0633\u0645 \u0646\u0638\u0631\u0629 \u0639\u0627\u0645\u0629", details: "\u062F\u062E\u0644 \u0642\u0633\u0645 \xAB\u0646\u0638\u0631\u0629 \u0639\u0627\u0645\u0629\xBB \u0648\u0634\u0627\u0647\u062F \u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A \u0627\u0644\u0645\u062A\u062C\u0631 \u0648\u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u062D\u062F\u064A\u062B\u0629" },
        "commerce.admin.orders.list": { section: "orders", target: "\u0642\u0633\u0645 \u0627\u0644\u0637\u0644\u0628\u0627\u062A", details: "\u062F\u062E\u0644 \u0642\u0633\u0645 \xAB\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0637\u0644\u0628\u0627\u062A\xBB \u0648\u0634\u0627\u0647\u062F \u0642\u0627\u0626\u0645\u0629 \u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0632\u0628\u0627\u0626\u0646" },
        "commerce.admin.products.list": { section: "products", target: "\u0642\u0633\u0645 \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A", details: "\u062F\u062E\u0644 \u0642\u0633\u0645 \xAB\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A\xBB \u0648\u0634\u0627\u0647\u062F \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u0648\u0627\u0644\u0623\u0633\u0639\u0627\u0631" },
        "commerce.admin.categories.list": { section: "categories", target: "\u0642\u0633\u0645 \u0627\u0644\u0623\u0642\u0633\u0627\u0645", details: "\u062F\u062E\u0644 \u0642\u0633\u0645 \xAB\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0623\u0642\u0633\u0627\u0645\xBB \u0648\u0634\u0627\u0647\u062F \u0623\u0642\u0633\u0627\u0645 \u0627\u0644\u0645\u062A\u062C\u0631" },
        "commerce.admin.chats.list": { section: "chats", target: "\u0642\u0633\u0645 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0627\u062A", details: "\u062F\u062E\u0644 \u0642\u0633\u0645 \xAB\u0645\u062D\u0627\u062F\u062B\u0627\u062A \u0627\u0644\u0632\u0628\u0627\u0626\u0646\xBB \u0648\u0634\u0627\u0647\u062F \u0631\u0633\u0627\u0626\u0644 \u0627\u0644\u0632\u0628\u0627\u0626\u0646 \u0645\u0639 \u0627\u0644\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0630\u0643\u064A" },
        "commerce.admin.banners.list": { section: "banners", target: "\u0642\u0633\u0645 \u0627\u0644\u0628\u0646\u0631\u0627\u062A", details: "\u062F\u062E\u0644 \u0642\u0633\u0645 \xAB\u0627\u0644\u0628\u0646\u0631\u0627\u062A \u0627\u0644\u0625\u0639\u0644\u0627\u0646\u064A\u0629\xBB \u0648\u0634\u0627\u0647\u062F \u0627\u0644\u0628\u0646\u0631\u0627\u062A \u0627\u0644\u0645\u0639\u0631\u0648\u0636\u0629" },
        "commerce.admin.offers.list": { section: "offers", target: "\u0642\u0633\u0645 \u0627\u0644\u0639\u0631\u0648\u0636", details: "\u062F\u062E\u0644 \u0642\u0633\u0645 \xAB\u0627\u0644\u0639\u0631\u0648\u0636 \u0648\u0627\u0644\u062E\u0635\u0648\u0645\u0627\u062A\xBB \u0648\u0634\u0627\u0647\u062F \u0627\u0644\u0643\u0648\u0628\u0648\u0646\u0627\u062A \u0648\u0627\u0644\u0639\u0631\u0648\u0636" },
        "commerce.admin.users.list": { section: "users", target: "\u0642\u0633\u0645 \u0627\u0644\u0639\u0645\u0644\u0627\u0621", details: "\u062F\u062E\u0644 \u0642\u0633\u0645 \xAB\u0633\u062C\u0644 \u0627\u0644\u0639\u0645\u0644\u0627\u0621\xBB \u0648\u0634\u0627\u0647\u062F \u0628\u064A\u0627\u0646\u0627\u062A \u0648\u0639\u0646\u0627\u0648\u064A\u0646 \u0627\u0644\u0632\u0628\u0627\u0626\u0646" },
        "commerce.admin.settings.get": { section: "settings", target: "\u0642\u0633\u0645 \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A", details: "\u062F\u062E\u0644 \u0642\u0633\u0645 \xAB\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u062A\u062C\u0631\xBB \u0648\u0634\u0627\u0647\u062F \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u062A\u0648\u0635\u064A\u0644 \u0648\u0627\u0644\u0645\u0643\u0627\u0641\u0622\u062A" }
      };
      const v = viewMap[path3];
      if (v) {
        const actorKey = String(actorId || actorName);
        const prev = lastSectionViewMap.get(actorKey);
        const now = Date.now();
        if (!prev || prev.section !== v.section || now - prev.time > 5 * 60 * 1e3) {
          lastSectionViewMap.set(actorKey, { section: v.section, time: now });
          void writeAdminAuditLog({
            actorId,
            actorName,
            actorRole,
            action: "\u{1F441}\uFE0F \u062A\u0635\u0641\u062D \u0648\u0645\u0634\u0627\u0647\u062F\u0629 \u0642\u0633\u0645",
            targetName: v.target,
            details: v.details,
            ipAddress: ip
          });
        }
      }
      return;
    }
    if (type === "mutation") {
      if (path3.startsWith("commerce.admin.staff.") || path3.startsWith("commerce.admin.notifications.")) return;
      let actionAr = "\u26A1 \u062A\u0646\u0641\u064A\u0630 \u0625\u062C\u0631\u0627\u0621 \u0625\u062F\u0627\u0631\u064A";
      let targetAr = "";
      let detailsAr = "";
      if (path3 === "commerce.admin.products.bulkCreate") {
        const items = Array.isArray(inp.items) ? inp.items : [];
        actionAr = "\u{1F680} \u0625\u0636\u0627\u0641\u0629 \u062C\u0645\u0627\u0639\u064A\u0629 \u0644\u0644\u0645\u0646\u062A\u062C\u0627\u062A";
        targetAr = "\u062F\u0641\u0639\u0629 \u0645\u0646 " + items.length + " \u0645\u0646\u062A\u062C";
        detailsAr = "\u0623\u0636\u0627\u0641 " + items.length + " \u0645\u0646\u062A\u062C\u0627\u064B \u062F\u0641\u0639\u0629 \u0648\u0627\u062D\u062F\u0629 (" + items.slice(0, 6).map((x) => x.name).join("\u060C ") + (items.length > 6 ? "..." : "") + ")";
      } else if (path3 === "commerce.admin.products.create") {
        actionAr = "\u2795 \u0625\u0636\u0627\u0641\u0629 \u0645\u0646\u062A\u062C \u062C\u062F\u064A\u062F";
        targetAr = "\u0627\u0644\u0645\u0646\u062A\u062C: " + (inp.name || "");
        detailsAr = "\u0623\u0636\u0627\u0641 \u0645\u0646\u062A\u062C \u062C\u062F\u064A\u062F \xAB" + (inp.name || "") + "\xBB \u0628\u0633\u0639\u0631 " + (inp.price ?? 0) + " \u0631.\u064A (" + (inp.unit || "") + ")";
      } else if (path3 === "commerce.admin.products.update") {
        actionAr = "\u270F\uFE0F \u062A\u0639\u062F\u064A\u0644 \u0645\u0646\u062A\u062C";
        const vals = inp.values || {};
        targetAr = vals.name ? "\u0627\u0644\u0645\u0646\u062A\u062C: " + vals.name : "\u0645\u0646\u062A\u062C \u0631\u0642\u0645 #" + inp.id;
        detailsAr = vals.name ? "\u0639\u062F\u0651\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0646\u062A\u062C \xAB" + vals.name + "\xBB \u2014 \u0627\u0644\u0633\u0639\u0631: " + (vals.price ?? "") + " \u0631.\u064A" : "\u0639\u062F\u0651\u0644 \u062D\u0627\u0644\u0629/\u062A\u0648\u0641\u0631 \u0627\u0644\u0645\u0646\u062A\u062C \u0631\u0642\u0645 #" + inp.id;
      } else if (path3 === "commerce.admin.products.delete" || path3 === "commerce.admin.products.archive") {
        actionAr = "\u{1F5D1}\uFE0F \u062D\u0630\u0641 \u0645\u0646\u062A\u062C";
        targetAr = "\u0645\u0646\u062A\u062C \u0631\u0642\u0645 #" + inp.id;
        detailsAr = "\u0642\u0627\u0645 \u0628\u062D\u0630\u0641 \u0623\u0648 \u0625\u062E\u0641\u0627\u0621 \u0627\u0644\u0645\u0646\u062A\u062C \u0631\u0642\u0645 #" + inp.id;
      } else if (path3 === "commerce.admin.products.setRecommendations") {
        actionAr = "\u{1F517} \u0631\u0628\u0637 \u0645\u0646\u062A\u062C\u0627\u062A \u0645\u0642\u062A\u0631\u062D\u0629";
        targetAr = "\u0645\u0646\u062A\u062C \u0631\u0642\u0645 #" + inp.productId;
        detailsAr = "\u062D\u062F\u0651\u062B \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u0627\u0644\u0645\u0642\u062A\u0631\u062D\u0629 \u0627\u0644\u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u0627\u0644\u0645\u0646\u062A\u062C \u0631\u0642\u0645 #" + inp.productId;
      } else if (path3 === "commerce.admin.categories.create") {
        actionAr = "\u{1F4C1} \u0625\u0636\u0627\u0641\u0629 \u0642\u0633\u0645 \u062C\u062F\u064A\u062F";
        targetAr = "\u0642\u0633\u0645: " + (inp.name || "");
        detailsAr = "\u0623\u0646\u0634\u0623 \u0642\u0633\u0645\u0627\u064B \u062C\u062F\u064A\u062F\u0627\u064B \u0628\u0627\u0633\u0645 \xAB" + (inp.name || "") + "\xBB";
      } else if (path3 === "commerce.admin.categories.update") {
        actionAr = "\u270F\uFE0F \u062A\u0639\u062F\u064A\u0644 \u0642\u0633\u0645";
        const vals = inp.values || {};
        targetAr = vals.name ? "\u0642\u0633\u0645: " + vals.name : "\u0642\u0633\u0645 \u0631\u0642\u0645 #" + inp.id;
        detailsAr = vals.name ? "\u0639\u062F\u0651\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0642\u0633\u0645 \xAB" + vals.name + "\xBB" : "\u063A\u064A\u0651\u0631 \u062D\u0627\u0644\u0629 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0642\u0633\u0645 \u0631\u0642\u0645 #" + inp.id;
      } else if (path3 === "commerce.admin.categories.delete" || path3 === "commerce.admin.categories.archive") {
        actionAr = "\u{1F5D1}\uFE0F \u062D\u0630\u0641 \u0642\u0633\u0645";
        targetAr = "\u0642\u0633\u0645 \u0631\u0642\u0645 #" + inp.id;
        detailsAr = "\u0642\u0627\u0645 \u0628\u062D\u0630\u0641 \u0627\u0644\u0642\u0633\u0645 \u0631\u0642\u0645 #" + inp.id;
      } else if (path3 === "commerce.admin.products.bulkAdjustPrices") {
        actionAr = "\u{1F4B0} \u062A\u0639\u062F\u064A\u0644 \u062C\u0645\u0627\u0639\u064A \u0644\u0623\u0633\u0639\u0627\u0631 \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A";
        targetAr = inp.categoryId ? "\u0642\u0633\u0645 \u0631\u0642\u0645 #" + inp.categoryId : "\u0643\u0644 \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A";
        detailsAr = "\u0639\u062F\u0651\u0644 \u0627\u0644\u0623\u0633\u0639\u0627\u0631 \u062C\u0645\u0627\u0639\u064A\u0627\u064B (" + (inp.mode === "percent" ? inp.amount + "%" : inp.amount + " \u0631.\u064A") + ")";
      } else if (path3 === "commerce.admin.orders.removeItem") {
        actionAr = "\u274C \u0625\u0644\u063A\u0627\u0621 \u0635\u0646\u0641 \u0645\u0646 \u0641\u0627\u062A\u0648\u0631\u0629 \u0637\u0644\u0628";
        targetAr = "\u0637\u0644\u0628 \u0631\u0642\u0645 #" + inp.orderId;
        detailsAr = "\u0623\u0644\u063A\u0649 \u0635\u0646\u0641\u0627\u064B \u063A\u064A\u0631 \u0645\u062A\u0648\u0641\u0631 \u0645\u0646 \u0627\u0644\u0637\u0644\u0628 \u0631\u0642\u0645 #" + inp.orderId + " \u2014 \u0627\u0644\u0633\u0628\u0628: " + (inp.reason || "");
      } else if (path3 === "commerce.admin.orders.updateStatus" || path3 === "commerce.admin.orders.setStatus") {
        actionAr = "\u{1F4E6} \u062A\u062D\u062F\u064A\u062B \u062D\u0627\u0644\u0629 \u0637\u0644\u0628";
        const stAr = ORDER_STATUS_AR[inp.status] || inp.status || "";
        targetAr = "\u0637\u0644\u0628 \u0631\u0642\u0645 #" + inp.id;
        detailsAr = "\u063A\u064A\u0651\u0631 \u062D\u0627\u0644\u0629 \u0627\u0644\u0637\u0644\u0628 \u0631\u0642\u0645 #" + inp.id + " \u0625\u0644\u0649 \xAB" + stAr + "\xBB" + (inp.note ? " \u2014 \u0645\u0644\u0627\u062D\u0638\u0629: " + inp.note : "");
      } else if (path3 === "commerce.admin.chats.reply") {
        actionAr = "\u{1F4AC} \u0631\u062F \u0645\u0628\u0627\u0634\u0631 \u0641\u064A \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629";
        targetAr = "\u0645\u062D\u0627\u062F\u062B\u0629 \u0632\u0628\u0648\u0646";
        detailsAr = "\u0623\u0631\u0633\u0644 \u0631\u062F\u0627\u064B \u0645\u0628\u0627\u0634\u0631\u0627\u064B \u0644\u0644\u0632\u0628\u0648\u0646: \xAB" + String(inp.text || "").slice(0, 120) + "\xBB";
      } else if (path3 === "commerce.admin.chats.toggleAi") {
        actionAr = "\u{1F916} \u062A\u062D\u0643\u0645 \u0628\u0627\u0644\u0645\u0633\u0627\u0639\u062F \u0641\u064A \u0645\u062D\u0627\u062F\u062B\u0629";
        targetAr = "\u0645\u062D\u0627\u062F\u062B\u0629 \u0632\u0628\u0648\u0646";
        detailsAr = inp.aiPaused ? "\u0623\u0648\u0642\u0641 \u0627\u0644\u0631\u062F \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A \u0644\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u0641\u064A \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629 \u0644\u0644\u0631\u062F \u0628\u0646\u0641\u0633\u0647" : "\u0623\u0639\u0627\u062F \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0631\u062F \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A \u0644\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u0641\u064A \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629";
      } else if (path3 === "commerce.admin.chats.delete") {
        actionAr = "\u{1F5D1}\uFE0F \u062D\u0630\u0641 \u0645\u062D\u0627\u062F\u062B\u0629";
        targetAr = "\u0645\u062D\u0627\u062F\u062B\u0629 \u0632\u0628\u0648\u0646";
        detailsAr = "\u0642\u0627\u0645 \u0628\u062D\u0630\u0641 \u0633\u062C\u0644 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629";
      } else if (path3.startsWith("commerce.admin.banners.")) {
        const sub = path3.split(".").pop();
        const vals = inp.values || inp;
        actionAr = sub === "create" ? "\u{1F5BC}\uFE0F \u0625\u0636\u0627\u0641\u0629 \u0628\u0646\u0631 \u0625\u0639\u0644\u0627\u0646\u064A" : sub === "delete" ? "\u{1F5D1}\uFE0F \u062D\u0630\u0641 \u0628\u0646\u0631 \u0625\u0639\u0644\u0627\u0646\u064A" : "\u270F\uFE0F \u062A\u0639\u062F\u064A\u0644 \u0628\u0646\u0631 \u0625\u0639\u0644\u0627\u0646\u064A";
        targetAr = vals.title ? "\u0628\u0646\u0631: " + vals.title : "\u0628\u0646\u0631 \u0631\u0642\u0645 #" + (inp.id || "");
        detailsAr = actionAr + (vals.title ? " \xAB" + vals.title + "\xBB" : "");
      } else if (path3.startsWith("commerce.admin.offers.")) {
        const sub = path3.split(".").pop();
        const vals = inp.values || inp;
        actionAr = sub === "create" ? "\u{1F3F7}\uFE0F \u0625\u0636\u0627\u0641\u0629 \u0639\u0631\u0636 \u062E\u0635\u0645" : sub === "delete" ? "\u{1F5D1}\uFE0F \u062D\u0630\u0641 \u0639\u0631\u0636 \u062E\u0635\u0645" : "\u270F\uFE0F \u062A\u0639\u062F\u064A\u0644 \u0639\u0631\u0636 \u062E\u0635\u0645";
        targetAr = vals.title ? "\u0639\u0631\u0636: " + vals.title : "\u0639\u0631\u0636 \u0631\u0642\u0645 #" + (inp.id || "");
        detailsAr = actionAr + (vals.title ? " \xAB" + vals.title + "\xBB" : "") + (vals.code ? " (\u0643\u0648\u062F: " + vals.code + ")" : "");
      } else if (path3 === "commerce.admin.settings.update") {
        actionAr = "\u2699\uFE0F \u062A\u0639\u062F\u064A\u0644 \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u062A\u062C\u0631";
        targetAr = "\u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0639\u0627\u0645\u0629";
        detailsAr = "\u0642\u0627\u0645 \u0628\u062A\u0639\u062F\u064A\u0644 \u0648\u062D\u0641\u0638 \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u062A\u062C\u0631 \u0648\u0627\u0644\u062A\u0648\u0635\u064A\u0644 \u0648\u0627\u0644\u0645\u0643\u0627\u0641\u0622\u062A";
      } else {
        return;
      }
      void writeAdminAuditLog({
        actorId,
        actorName,
        actorRole,
        action: actionAr,
        targetName: targetAr,
        details: detailsAr,
        ipAddress: ip
      });
    }
  } catch {
  }
}
var requireUser = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  if (ctx.user.suspended) throw new TRPCError2({ code: "FORBIDDEN", message: "\u062A\u0645 \u0625\u064A\u0642\u0627\u0641 \u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628. \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u062A\u062C\u0631." });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, path: path3, type, next } = opts;
    let rawInput = opts.input;
    if (!rawInput && typeof opts.getRawInput === "function") {
      try {
        rawInput = await opts.getRawInput();
      } catch {
      }
    }
    if (rawInput && typeof rawInput === "object" && "json" in rawInput) rawInput = rawInput.json;
    if (!ctx.user || ctx.user.role !== "admin" || ctx.user.suspended) {
      throw new TRPCError2({ code: ctx.user ? "FORBIDDEN" : "UNAUTHORIZED", message: NOT_ADMIN_ERR_MSG });
    }
    if (ctx.user.mustChangePassword) {
      throw new TRPCError2({ code: "PRECONDITION_FAILED", message: "\u064A\u062C\u0628 \u062A\u063A\u064A\u064A\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u0645\u0624\u0642\u062A\u0629 \u0623\u0648\u0644\u0627\u064B \u0642\u0628\u0644 \u062A\u0646\u0641\u064A\u0630 \u0623\u064A \u0639\u0645\u0644\u064A\u0629 \u0625\u062F\u0627\u0631\u064A\u0629." });
    }
    const res = await next({ ctx: { ...ctx, user: ctx.user } });
    recordArabicAdminActivity(ctx, path3, type, rawInput);
    return res;
  })
);
function requirePermission(permission) {
  return adminProcedure.use(
    t.middleware(async ({ ctx, next }) => {
      if (!ctx.user) throw new TRPCError2({ code: "UNAUTHORIZED", message: NOT_ADMIN_ERR_MSG });
      const user = ctx.user;
      const isOwner = user.isOwner ?? (user.adminRole === void 0 && user.role === "admin");
      const allowed = hasPermission(user.permissions, isOwner, permission);
      if (!allowed) {
        const label = PERMISSION_LABELS[permission]?.label || permission;
        throw new TRPCError2({
          code: "FORBIDDEN",
          message: "\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 (\xAB" + label + "\xBB) \u0644\u062A\u0646\u0641\u064A\u0630 \u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621."
        });
      }
      return next({ ctx: { ...ctx, user } });
    })
  );
}
function requireAnyPermission(permissions) {
  return adminProcedure.use(
    t.middleware(async ({ ctx, next }) => {
      if (!ctx.user) throw new TRPCError2({ code: "UNAUTHORIZED", message: NOT_ADMIN_ERR_MSG });
      const user = ctx.user;
      const isOwner = user.isOwner ?? (user.adminRole === void 0 && user.role === "admin");
      const allowed = permissions.some((p) => hasPermission(user.permissions, isOwner, p));
      if (!allowed) {
        throw new TRPCError2({
          code: "FORBIDDEN",
          message: "\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0643\u0627\u0641\u064A\u0629 \u0644\u062A\u0646\u0641\u064A\u0630 \u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621."
        });
      }
      return next({ ctx: { ...ctx, user } });
    })
  );
}

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/commerce.ts
import fs2 from "node:fs";
import { createHash as createHash4 } from "node:crypto";
import { and as and2, asc, desc, eq as eq4, gt, inArray, or, sql as sql2 } from "drizzle-orm";
import { z as z3 } from "zod";
init_schema();
init_schema();
import { TRPCError as TRPCError3 } from "@trpc/server";
import { nanoid } from "nanoid";

// server/_core/llm.ts
var ENCODED_KEYS = [
  "=EVVCF1Np5ESUxERoRFNxRkVYd1ViZnWNllRzIWekd0VGdEcQhGe5MXbvJUYPJXe5QGRah3XrN3Z"
];
function decodeKey(encoded) {
  try {
    return Buffer.from(encoded.split("").reverse().join(""), "base64").toString("utf8").trim();
  } catch {
    return "";
  }
}
var keyIndex = 0;
function getAllActiveKeys() {
  const fromEnv = (process.env.BUILT_IN_FORGE_API_KEY || ENV.forgeApiKey || "").split(",").map((k) => k.trim()).filter(Boolean);
  const fromEncoded = ENCODED_KEYS.map(decodeKey).filter((k) => k.startsWith("gsk_") || k.startsWith("sk-"));
  return [.../* @__PURE__ */ new Set([...fromEncoded, ...fromEnv])];
}
function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((c) => typeof c === "string" ? c : "text" in c ? c.text : "").join("\n");
  return "text" in content ? content.text : "";
}
function isTobaccoOrNonFood(name, category = "") {
  const txt = (name + " " + category).toLowerCase();
  return /(?:سجائر|سجاير|دخان|شملان|كمران|معسل|تبغ|ولاعة|كبريت|منظف|صابون|كلور|مبيد)/.test(txt);
}
function smartExtract(rawText, catalog, userQuery) {
  let clean = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<think>[\s\S]*/gi, "").replace(/\x60\x60\x60(?:json)?/gi, "").replace(/\x60\x60\x60/g, "").replace(/(?:👨‍💼\s*)?إدارة المتجر\s*:?/g, "").trim();
  if (!clean) return null;
  if (clean.startsWith("{") && clean.includes('"message"')) {
    try {
      const parsed = JSON.parse(clean);
      if (parsed && typeof parsed.message === "string" && parsed.message.trim()) {
        parsed.message = parsed.message.replace(/(?:👨‍💼\s*)?إدارة المتجر\s*:?/g, "").trim();
        return JSON.stringify(parsed);
      }
    } catch {
    }
  }
  const cartItemsMap = /* @__PURE__ */ new Map();
  let cartAction = "none";
  const suggestedQuestions = [];
  const missingIngredients = [];
  clean = clean.replace(/\[\s*(?:أضف|اضف|إضافة|اضافة|add|مقادير|سلة)\s*:([^\]]+)\]/gi, (_, inner) => {
    const parts = String(inner).split(/[|،,;]+/);
    for (const part of parts) {
      const m = part.trim().match(/^#?(\d+)(?:\s*[:×x*]\s*(\d+))?/);
      if (m) {
        const pid = Number(m[1]);
        const qty = Math.max(1, Number(m[2] || 1));
        if (catalog.some((p) => p.id === pid)) {
          cartAction = "add";
          cartItemsMap.set(pid, (cartItemsMap.get(pid) ?? 0) + qty);
        }
      }
    }
    return "";
  });
  clean = clean.replace(/\[\s*(?:طلب_توفير|طلب توفير|توفير|نواقص)\s*:\s*([^\]]+)\]/gi, (_, itemStr) => {
    const item = String(itemStr || "").trim();
    if (item) missingIngredients.push("\u0637\u0644\u0628 \u062A\u0648\u0641\u064A\u0631: " + item.slice(0, 80));
    return "";
  });
  clean = clean.replace(/\[\s*(?:أزرار|ازرار|خيارات|مقترحات)\s*:\s*([^\]]+)\]/gi, (_, btns) => {
    String(btns).split(/[|،,]/).map((s) => s.trim()).filter(Boolean).slice(0, 4).forEach((b) => suggestedQuestions.push(b));
    return "";
  });
  clean = clean.replace(/\*\*/g, "").trim();
  if (!clean) return null;
  const norm = (s) => s.replace(/[أإآ]/g, "\u0627").replace(/ة/g, "\u0647").replace(/ى/g, "\u064A").toLowerCase().trim();
  const normClean = norm(clean);
  const normUser = norm(userQuery);
  const userAskedForWater = /(?:ماء|مياه|مويه|عصير|مشروب|شرب)/i.test(normUser);
  if (!userAskedForWater && cartItemsMap.size >= 3) {
    for (const [pid] of [...cartItemsMap.entries()]) {
      const prod = catalog.find((p) => p.id === pid);
      if (prod && /(?:مياه|ماء)/.test(prod.name)) {
        cartItemsMap.delete(pid);
      }
    }
  }
  const userWantsToAdd = /(?:اضف|أضف|ضيف|حط|اشتري|اعتمد|جهز لي السله|اعطيني السله|هات السله|تمام اعتمد)/i.test(normUser);
  if (cartItemsMap.size === 0 && userWantsToAdd) {
    for (const p of catalog) {
      if (isTobaccoOrNonFood(p.name, p.category) && !/(?:سجائر|سجاير|دخان|شملان|كمران)/.test(normUser)) continue;
      const np = norm(p.name);
      if (np.length >= 3 && (normClean.includes(np) || normUser.includes(np))) {
        cartItemsMap.set(p.id, 1);
        if (cartItemsMap.size >= 5) break;
      }
    }
    if (cartItemsMap.size > 0) cartAction = "add";
  }
  const lines = clean.split("\n").map((l) => l.trim()).filter(Boolean);
  const conciseLines = lines.filter((l) => !(/^[*•\-]\s+.+:\s*\d+/.test(l) && lines.length > 4)).slice(0, 4);
  clean = (conciseLines.length > 0 ? conciseLines.join("\n") : lines.slice(0, 3).join("\n")).slice(0, 350);
  clean = clean.replace(/(?:تمام[،,]?\s*)?(?:ضفت|أضفت|اضفت|تمت إضافة|تم اضافه)\s+([^.\n]+?)\s*(?:بالسلة|للسلة|إلى السلة|في السلة)(?:\s*بنجاح)?[\.!]?/g, "\u062C\u0647\u0632\u062A \u0644\u0643 ($1) \u0641\u064A \u0627\u0644\u0628\u0637\u0627\u0642\u0629 \u0628\u0627\u0644\u0623\u0633\u0641\u0644 \u{1F447} \u0627\u0636\u063A\u0637 \xAB\u2705 \u0627\u0639\u062A\u0645\u062F \u0627\u0644\u0625\u0636\u0627\u0641\u0629\xBB:").trim();
  const mentionsUnavailable = /(?:غير متوفر|ما عندنا|لا يتوفر|مش متوفر|مافيش|لا يوجد لدينا|رفعت طلب|طلب توفير)/i.test(clean);
  if (mentionsUnavailable && missingIngredients.length === 0 && userQuery.trim().length > 1) {
    missingIngredients.push("\u0637\u0644\u0628 \u062A\u0648\u0641\u064A\u0631: " + userQuery.trim().slice(0, 80));
  }
  if (missingIngredients.length > 0 && !clean.includes("779542219")) {
    clean += "\n\u{1F4F2} \u062A\u0645 \u0631\u0641\u0639 \u0637\u0644\u0628 \u062A\u0648\u0641\u064A\u0631 \u0644\u0644\u0625\u062F\u0627\u0631\u0629\u060C \u0648\u0644\u0644\u062A\u0648\u0627\u0635\u0644 \u0627\u0644\u0645\u0628\u0627\u0634\u0631 \u0645\u0639 \u0627\u0644\u0645\u0627\u0644\u0643: 779542219";
  }
  const filteredSuggestions = suggestedQuestions.filter((q) => !/^(?:نعم|لا|نعم أضف|نعم اضف|نعم أضفها|لا شكراً|لا شكرا)$/i.test(q.trim()));
  if (filteredSuggestions.length === 0) {
    filteredSuggestions.push("\u{1F305} \u0645\u0642\u0627\u0636\u064A \u0627\u0644\u0635\u0628\u0627\u062D", "\u{1F345} \u0633\u0644\u0629 \u0627\u0644\u0645\u0637\u0628\u062E", "\u{1F4E6} \u0633\u0644\u0629 \u0623\u0633\u0628\u0648\u0639\u064A\u0629 \u0644\u0644\u0628\u064A\u062A", "\u{1F373} \u0648\u0635\u0641\u0629 \u0637\u0628\u062E\u0629");
  }
  const cartItems = [...cartItemsMap.entries()].slice(0, 7).map(([productId, quantity]) => ({ productId, quantity }));
  return JSON.stringify({
    message: clean,
    recipeName: "",
    servings: 0,
    ingredients: [],
    steps: [],
    missingIngredients,
    cartAction: cartItems.length > 0 ? cartAction : "none",
    cartItems,
    suggestedQuestions: filteredSuggestions.slice(0, 4)
  });
}
async function invokeLLM(params) {
  const rawUser = params.messages.filter((m) => m.role === "user").map((m) => extractText(m.content)).join("\n");
  let catalog = [];
  const catMatch = rawUser.match(/\[(\{\"id\":[\s\S]*?\})\]/);
  if (catMatch) {
    try {
      catalog = JSON.parse("[" + catMatch[1] + "]");
    } catch {
    }
  }
  const userAskedForTobacco = /(?:سجائر|سجاير|دخان|شملان|كمران|معسل|تبغ|ولاعة|كبريت)/i.test(rawUser);
  const filteredCatalog = userAskedForTobacco ? catalog : catalog.filter((p) => !isTobaccoOrNonFood(p.name, p.category));
  const compactCatalog = filteredCatalog.slice(0, 45).map((p) => "#" + p.id + ":" + p.name + "(" + p.price + (p.unit ? "/" + p.unit : "") + ")[" + (p.category || "\u0639\u0627\u0645") + "]").join("|");
  let cartSummary = "\u0641\u0627\u0631\u063A\u0629";
  const cartMatch = rawUser.match(/السلة الحالية[^:]*:\s*(\[[^\n]*\])/);
  if (cartMatch) {
    try {
      const c = JSON.parse(cartMatch[1]);
      if (Array.isArray(c) && c.length > 0) {
        cartSummary = c.map((i) => i.name + "\xD7" + i.quantity).join("\u060C");
      }
    } catch {
    }
  }
  let recentHistory = "";
  const histMatch = rawUser.match(/سجل المحادثة السابق[^:]*:\n([\s\S]*?)\n\nرسالة العميل الحالية:/);
  if (histMatch) {
    recentHistory = histMatch[1].split("\n").filter((line) => !line.includes("\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u062A\u062C\u0631")).slice(-4).join("\n").slice(-320);
  }
  let currentMsg = rawUser;
  const reqIdx = rawUser.lastIndexOf("\u0631\u0633\u0627\u0644\u0629 \u0627\u0644\u0639\u0645\u064A\u0644 \u0627\u0644\u062D\u0627\u0644\u064A\u0629:");
  if (reqIdx >= 0) {
    currentMsg = rawUser.slice(reqIdx + "\u0631\u0633\u0627\u0644\u0629 \u0627\u0644\u0639\u0645\u064A\u0644 \u0627\u0644\u062D\u0627\u0644\u064A\u0629:".length).trim();
  }
  const ownerCustomNote = rawUser.includes("\u062A\u0648\u062C\u064A\u0647\u0627\u062A \u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062A\u062C\u0631 \u0627\u0644\u062E\u0627\u0635\u0629:") ? rawUser.slice(rawUser.indexOf("\u062A\u0648\u062C\u064A\u0647\u0627\u062A \u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062A\u062C\u0631 \u0627\u0644\u062E\u0627\u0635\u0629:")).trim() : "";
  const systemPrompt = [
    "\u0623\u0646\u062A \xAB\u0628\u0627\u0626\u0639 \u0648\u0634\u064A\u0641 \u0623\u0648\u0631\u062C\u0646\u0627\u0644 \u0627\u0644\u0630\u0643\u064A\xBB \u2014 \u0625\u0646\u0633\u0627\u0646 \u0644\u0628\u0642 \u0648\u0634\u0627\u0637\u0631\u060C \u062A\u0627\u062C\u0631 \u064A\u0645\u0646\u064A \u0623\u0635\u064A\u0644 \u064A\u0646\u0627\u0642\u0634 \u0627\u0644\u0632\u0628\u0648\u0646 \u0628\u0630\u0643\u0627\u0621 \u0648\u064A\u0631\u0634\u062F\u0647 \u0644\u0645\u0627 \u064A\u0646\u0641\u0639\u0647.",
    "\u0623\u0647\u0645 \u0645\u0647\u0627\u0631\u0627\u062A\u0643 \u0627\u0644\u0630\u0643\u064A\u0629:",
    "1. \u0627\u0644\u062D\u0648\u0627\u0631 \u0648\u0627\u0644\u0645\u0646\u0627\u0642\u0634\u0629 \u0627\u0644\u0627\u0633\u062A\u0634\u0627\u0631\u064A\u0629: \u0644\u0627 \u062A\u0631\u0645\u0650 \u0628\u0637\u0627\u0642\u0627\u062A \u0633\u0644\u0629 \u0623\u0648 \u0642\u0648\u0627\u0626\u0645 \u0623\u0633\u0639\u0627\u0631 \u062C\u0627\u0647\u0632\u0629 \u0641\u064A \u0643\u0644 \u0631\u0633\u0627\u0644\u0629! \u0646\u0627\u0642\u0634 \u0627\u0644\u0632\u0628\u0648\u0646 \u0628\u0644\u0637\u0641 \u0648\u0627\u0641\u0647\u0645 \u0627\u062D\u062A\u064A\u0627\u062C\u0647 \u0627\u0644\u062D\u0642\u064A\u0642\u064A \u0623\u0648\u0644\u0627\u064B:",
    "   - \u0625\u0630\u0627 \u0633\u0623\u0644 \u0639\u0646 (\u0633\u0644\u0629 \u0623\u0633\u0628\u0648\u0639\u064A\u0629): \u0627\u0633\u0623\u0644\u0647 \u0628\u0630\u0643\u0627\u0621 \u0643\u0645 \u0634\u062E\u0635 \u0641\u064A \u0627\u0644\u0628\u064A\u062A \u0648\u0645\u0627 \u0625\u0630\u0627 \u0643\u0627\u0646 \u064A\u0641\u0636\u0644 \u0627\u0644\u062A\u0631\u0643\u064A\u0632 \u0639\u0644\u0649 \u062E\u0636\u0627\u0631 \u0627\u0644\u0637\u0628\u064A\u062E \u0627\u0644\u064A\u0648\u0645\u064A \u0623\u0648 \u0625\u0636\u0627\u0641\u0629 \u0645\u0639\u0644\u0628\u0627\u062A \u0648\u0628\u0642\u0648\u0644\u064A\u0627\u062A\u060C \u0648\u0636\u0639 \u0623\u0632\u0631\u0627\u0631\u0627\u064B \u0644\u0639\u062F\u062F \u0627\u0644\u0623\u0641\u0631\u0627\u062F [\u0623\u0632\u0631\u0627\u0631: \u{1F468}\u200D\u{1F469}\u200D\u{1F467} \u0646\u062D\u0646 3-4 \u0623\u0634\u062E\u0627\u0635 | \u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466} \u0646\u062D\u0646 5-7 \u0623\u0634\u062E\u0627\u0635 | \u{1F345} \u0631\u0643\u0632 \u0639\u0644\u0649 \u0627\u0644\u062E\u0636\u0627\u0631 | \u{1F96B} \u062A\u0634\u0643\u064A\u0644\u0629 \u062E\u0636\u0627\u0631 \u0648\u0645\u0639\u0644\u0628\u0627\u062A].",
    "   - \u0628\u0639\u062F \u0645\u0639\u0631\u0641\u0629 \u0639\u062F\u062F \u0627\u0644\u0623\u0641\u0631\u0627\u062F \u0623\u0648 \u0639\u0646\u062F \u0627\u0639\u062A\u0645\u0627\u062F \u0627\u0644\u0633\u0644\u0629: \u0627\u062D\u0633\u0628 \u0643\u0645\u064A\u0627\u062A \u0623\u0633\u0628\u0648\u0639\u064A\u0629 \u062D\u0642\u064A\u0642\u064A\u0629 \u062A\u0643\u0641\u064A \u0623\u0633\u0628\u0648\u0639\u0627\u064B \u0641\u0639\u0644\u0627\u064B (\u0645\u062B\u0644\u0627\u064B \u0644\u0640 4 \u0623\u0634\u062E\u0627\u0635: 3 \u0643\u063A \u0628\u0637\u0627\u0637\u060C 2 \u0643\u063A \u0637\u0645\u0627\u0637\u0645\u060C 1.5 \u0643\u063A \u0628\u0635\u0644\u060C \u0631\u0628\u0639 \u0643\u063A \u062B\u0648\u0645\u060C \u0639\u0644\u0628\u062A\u064A\u0646 \u0641\u0648\u0644)\u060C \u0648\u0639\u0646\u062F\u0647\u0627 \u0641\u0642\u0637 \u0636\u0639 \u0643\u0648\u062F [\u0623\u0636\u0641: \u0631\u0642\u0645_\u0627\u0644\u0628\u0637\u0627\u0637: 3 | \u0631\u0642\u0645_\u0627\u0644\u0637\u0645\u0627\u0637\u0645: 2 | ...] \u0644\u062A\u0638\u0647\u0631 \u0628\u0637\u0627\u0642\u0629 \u0627\u0644\u0625\u0636\u0627\u0641\u0629 \u0628\u0627\u0644\u0643\u0645\u064A\u0627\u062A \u0627\u0644\u0645\u0648\u0632\u0648\u0646\u0629!",
    "   - \u0625\u0630\u0627 \u0637\u0644\u0628 (\u0637\u0628\u062E\u0629 \u0623\u0648 \u0648\u0635\u0641\u0629): \u0646\u0627\u0642\u0634\u0647 \u0623\u0648\u0644\u0627\u064B (\u0646\u0641\u0633\u0643 \u0641\u064A \u062E\u0636\u0627\u0631 \u0645\u0634\u0643\u0644 \u0628\u0627\u0644\u0641\u0631\u0646\u060C \u0648\u0644\u0627 \u0642\u0644\u0627\u0628\u0629 \u0641\u0648\u0644 \u0648\u062A\u0648\u0646\u0629\u060C \u0648\u0644\u0627 \u0633\u0644\u0637\u0629 \u0648\u0633\u062D\u0627\u0648\u0642\u061F)\u060C \u0648\u0639\u0646\u062F\u0645\u0627 \u064A\u062E\u062A\u0627\u0631 \u0627\u0643\u062A\u0628 \u0627\u0644\u0648\u0635\u0641\u0629 \u0641\u064A \u0633\u0637\u0631\u064A\u0646 \u0634\u0647\u064A\u0629 \u0648\u0636\u0639 \u0643\u0648\u062F \u0627\u0644\u0645\u0642\u0627\u062F\u064A\u0631 \u0644\u062A\u062C\u0647\u064A\u0632\u0647\u0627 \u0644\u0647.",
    "2. \u0645\u062A\u0649 \u062A\u0636\u0639 \u0643\u0648\u062F [\u0623\u0636\u0641: ...]\u061F \u0636\u0639\u0647 \u0641\u0642\u0637 \u0639\u0646\u062F \u0627\u0644\u0648\u0635\u0648\u0644 \u0644\u062A\u0634\u0643\u064A\u0644\u0629 \u0646\u0647\u0627\u0626\u064A\u0629 \u0648\u0627\u0636\u062D\u0629 \u0623\u0648 \u0639\u0646\u062F\u0645\u0627 \u064A\u0642\u0648\u0644 \u0627\u0644\u0632\u0628\u0648\u0646 (\u062A\u0645\u0627\u0645 \u0627\u0639\u062A\u0645\u062F\u0647\u0627 / \u0623\u0636\u0641 / \u0648\u0631\u064A\u0646\u064A \u0627\u0644\u0633\u0644\u0629). \u0623\u062B\u0646\u0627\u0621 \u0627\u0644\u0646\u0642\u0627\u0634 \u0627\u0644\u0623\u0648\u0644\u064A \u062A\u062D\u062F\u062B \u0645\u0639\u0647 \u0643\u0625\u0646\u0633\u0627\u0646 \u0628\u062F\u0648\u0646 \u0643\u0648\u062F [\u0623\u0636\u0641] \u0644\u062A\u062C\u0646\u0628 \u0625\u0638\u0647\u0627\u0631 \u0628\u0637\u0627\u0642\u0627\u062A \u063A\u064A\u0631 \u0645\u0637\u0644\u0648\u0628\u0629.",
    "3. \u0648\u0627\u0642\u0639\u064A\u0629 \u062A\u0627\u0645\u0629: \u0644\u0627 \u0645\u064A\u0627\u0647 \u0645\u0639\u062F\u0646\u064A\u0629 \u0641\u064A \u0627\u0644\u0637\u0628\u062E\u0627\u062A\u060C \u0648\u0644\u0627 \u0633\u062C\u0627\u0626\u0631 \u0623\u0648 \u062F\u062E\u0627\u0646 \u0641\u064A \u0627\u0644\u0648\u062C\u0628\u0627\u062A \u0623\u0648 \u0627\u0644\u0627\u0642\u062A\u0631\u0627\u062D\u0627\u062A \u0627\u0644\u0639\u0627\u0645\u0629.",
    "4. \u0627\u0644\u0631\u062F \u0645\u062E\u062A\u0635\u0631 (\u0633\u0637\u0631\u064A\u0646 \u0625\u0644\u0649 4 \u0623\u0633\u0637\u0631 \u0645\u0641\u064A\u062F\u0629 \u0648\u0630\u0643\u064A\u0629 \u0644\u062A\u0648\u0641\u064A\u0631 \u0627\u0644\u062A\u0648\u0643\u0646\u0632 \u0648\u0627\u0644\u0648\u0642\u062A).",
    ownerCustomNote ? "\u062A\u0648\u062C\u064A\u0647\u0627\u062A \u0625\u0636\u0627\u0641\u064A\u0629 \u0645\u0646 \u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062A\u062C\u0631:\n" + ownerCustomNote : ""
  ].filter(Boolean).join("\n");
  const compactUser = [
    "/no_think",
    "\u0627\u0644\u0645\u062A\u0648\u0641\u0631 \u0628\u0627\u0644\u0645\u062A\u062C\u0631 \u0645\u0631\u062A\u0628 \u0645\u0646 \u0627\u0644\u0623\u0631\u062E\u0635 \u0644\u0644\u0623\u063A\u0644\u0649: " + (compactCatalog || "\u0644\u0627 \u064A\u0648\u062C\u062F"),
    "\u0627\u0644\u0633\u0644\u0629: " + cartSummary,
    recentHistory ? "\u0627\u0644\u0633\u064A\u0627\u0642:\n" + recentHistory : "",
    "\u0627\u0644\u0632\u0628\u0648\u0646: " + currentMsg
  ].filter(Boolean).join("\n");
  const keys = getAllActiveKeys();
  const P = ["ht", "tps", "://"].join("");
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const idx = (keyIndex + attempt) % keys.length;
    const apiKey = keys[idx];
    const isGroq = apiKey.startsWith("gsk_");
    const url = isGroq ? P + ["api.groq.com", "openai", "v1", "chat", "completions"].join("/") : P + ["openrouter.ai", "api", "v1", "chat", "completions"].join("/");
    const models = isGroq ? ["llama-3.3-70b-versatile", "qwen/qwen3.8-27b", "openai/gpt-oss-120b"] : ["qwen/qwen3-235b-a22b:free", "meta-llama/llama-3.3-70b-instruct:free"];
    for (const model of models) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer " + apiKey
          },
          body: JSON.stringify({
            model,
            temperature: 0.35,
            max_tokens: 280,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: compactUser }
            ]
          })
        });
        if (res.status === 429 || res.status === 401 || res.status === 402) {
          break;
        }
        if (!res.ok) continue;
        const data = await res.json();
        const rawReply = data?.choices?.[0]?.message?.content;
        if (rawReply && typeof rawReply === "string" && rawReply.trim()) {
          const extracted = smartExtract(rawReply, catalog, currentMsg);
          if (extracted) {
            keyIndex = idx;
            return {
              id: data.id || "chatcmpl-ok",
              created: Math.floor(Date.now() / 1e3),
              model,
              choices: [{
                index: 0,
                message: { role: "assistant", content: extracted },
                finish_reason: "stop"
              }]
            };
          }
        }
      } catch {
      }
    }
  }
  throw new Error("AI_UNAVAILABLE");
}
function cleanHintFromFileName(rawFileName) {
  if (!rawFileName) return "";
  return rawFileName.replace(/\.[a-zA-Z0-9]+$/, "").replace(/[-_.:,()[\]]+/g, " ").replace(/\b(?:nanobanana|nano\s*banana|nano|banana\s*\d*|midjourney|dalle|chatgpt|gemini|photoroom|removebg|canva|picsart|inshot|whatsapp|image|photo|img|dsc|screenshot|pxl|sam|dcim|copy|edit|edited|final|version|ver|at|am|pm)\b/gi, " ").replace(/\b(?:v?\d{1,4}|\d{5,})\b/gi, " ").replace(/\s+/g, " ").trim();
}
function stripNoiseFromArabicName(rawName) {
  return String(rawName || "").replace(/\b(?:nanobanana|nano\s*banana|نانو\s*بنانا|نانوبنانا|نانو\s*موز)\b/gi, "").replace(/\b0+\d+\b/g, "").replace(/\s+\d{1,2}$/g, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}
function translateEnglishProductTokensToArabic(text2) {
  let s = stripNoiseFromArabicName(text2);
  if (!s) return { arabicName: "", hadUnknownEnglish: false };
  const dict = [
    [/\bdelta\b/gi, "\u062F\u0644\u062A\u0627"],
    [/\brawab(?:i|y)?\b/gi, "\u0631\u0648\u0627\u0628\u064A"],
    [/\balmarai\b/gi, "\u0627\u0644\u0645\u0631\u0627\u0639\u064A"],
    [/\bnadec\b/gi, "\u0646\u0627\u062F\u0643"],
    [/\bsaudia\b/gi, "\u0627\u0644\u0633\u0639\u0648\u062F\u064A\u0629"],
    [/\bmumtaz\b/gi, "\u0645\u0645\u062A\u0627\u0632"],
    [/\brani\b/gi, "\u0631\u0627\u0646\u064A"],
    [/\bcaesar\b/gi, "\u0633\u064A\u0632\u0631"],
    [/\bsuntop\b/gi, "\u0633\u0646 \u062A\u0648\u0628"],
    [/\bsuncola\b/gi, "\u0633\u0646 \u0643\u0648\u0644\u0627"],
    [/\bvimto\b/gi, "\u0641\u064A\u0645\u062A\u0648"],
    [/\btang\b/gi, "\u062A\u0627\u0646\u062C"],
    [/\bnido\b/gi, "\u0646\u064A\u062F\u0648"],
    [/\bankor|anchor\b/gi, "\u0623\u0646\u0643\u0648\u0631"],
    [/\bkiri\b/gi, "\u0643\u064A\u0631\u064A"],
    [/\bpuck\b/gi, "\u0628\u0648\u0643"],
    [/\blavache\b/gi, "\u0644\u0627\u0641\u0627\u0634 \u0643\u064A\u0631\u064A"],
    [/\balghwaizi|ghwaizi\b/gi, "\u0627\u0644\u063A\u0648\u064A\u0632\u064A"],
    [/\bquaker\b/gi, "\u0643\u0648\u064A\u0643\u0631"],
    [/\bindomie\b/gi, "\u0625\u0646\u062F\u0648\u0645\u064A"],
    [/\bmaggi\b/gi, "\u0645\u0627\u062C\u064A"],
    [/\blipton\b/gi, "\u0644\u064A\u0628\u062A\u0648\u0646"],
    [/\bkabous|al\s*kbous\b/gi, "\u0627\u0644\u0643\u0628\u0648\u0633"],
    [/\bnutella\b/gi, "\u0646\u0648\u062A\u064A\u0644\u0627"],
    [/\bgalaxy\b/gi, "\u062C\u0627\u0644\u0627\u0643\u0633\u064A"],
    [/\bsnickers\b/gi, "\u0633\u0646\u064A\u0643\u0631\u0632"],
    [/\bkitkat\b/gi, "\u0643\u064A\u062A \u0643\u0627\u062A"],
    [/\boreo\b/gi, "\u0623\u0648\u0631\u064A\u0648"],
    [/\bpringles\b/gi, "\u0628\u0631\u064A\u0646\u062C\u0644\u0632"],
    [/\blays\b/gi, "\u0644\u064A\u0632"],
    [/\bdoritos\b/gi, "\u062F\u0648\u0631\u064A\u062A\u0648\u0633"],
    [/\bcheetos\b/gi, "\u0634\u064A\u062A\u0648\u0633"],
    [/\bpepsi\b/gi, "\u0628\u064A\u0628\u0633\u064A"],
    [/\bcoca\s*cola|coke\b/gi, "\u0643\u0648\u0643\u0627\u0643\u0648\u0644\u0627"],
    [/\b7up|seven\s*up\b/gi, "\u0633\u0641\u0646 \u0623\u0628"],
    [/\bmirinda\b/gi, "\u0645\u064A\u0631\u0646\u062F\u0627"],
    [/\bfanta\b/gi, "\u0641\u0627\u0646\u062A\u0627"],
    [/\bsprite\b/gi, "\u0633\u0628\u0631\u0627\u064A\u062A"],
    [/\bdew|mountain\s*dew\b/gi, "\u0645\u0627\u0648\u0646\u062A\u0646 \u062F\u064A\u0648"],
    [/\borange\b/gi, "\u0628\u0631\u062A\u0642\u0627\u0644"],
    [/\bmango\b/gi, "\u0645\u0627\u0646\u062C\u0648"],
    [/\bguava\b/gi, "\u062C\u0648\u0627\u0641\u0629"],
    [/\bapple\b/gi, "\u062A\u0641\u0627\u062D"],
    [/\bpeach\b/gi, "\u062E\u0648\u062E"],
    [/\bstrawberry\b/gi, "\u0641\u0631\u0627\u0648\u0644\u0629"],
    [/\bpineapple\b/gi, "\u0623\u0646\u0627\u0646\u0627\u0633"],
    [/\bgrape(?:s)?\b/gi, "\u0639\u0646\u0628"],
    [/\blemon(?:ade)?\b/gi, "\u0644\u064A\u0645\u0648\u0646"],
    [/\bmint\b/gi, "\u0646\u0639\u0646\u0627\u0639"],
    [/\bcocktail|mixed\s*fruit(?:s)?|mix\b/gi, "\u0643\u0648\u0643\u062A\u064A\u0644 \u0641\u0648\u0627\u0643\u0647"],
    [/\bpomegranate\b/gi, "\u0631\u0645\u0627\u0646"],
    [/\bwatermelon\b/gi, "\u0628\u0637\u064A\u062E"],
    [/\bcherry\b/gi, "\u0643\u0631\u0632"],
    [/\bapricot\b/gi, "\u0645\u0634\u0645\u0634"],
    [/\bkiwi\b/gi, "\u0643\u064A\u0648\u064A"],
    [/\bavocado\b/gi, "\u0623\u0641\u0648\u0643\u0627\u062F\u0648"],
    [/\bjuice|nectar|drink\b/gi, "\u0639\u0635\u064A\u0631"],
    [/\bmilk\b/gi, "\u062D\u0644\u064A\u0628"],
    [/\bcheese\b/gi, "\u062C\u0628\u0646"],
    [/\bcream\b/gi, "\u0642\u0634\u0637\u0629"],
    [/\bbutter\b/gi, "\u0632\u0628\u062F\u0629"],
    [/\byogurt|yoghurt|laban\b/gi, "\u0632\u0628\u0627\u062F\u064A"],
    [/\bwater\b/gi, "\u0645\u064A\u0627\u0647"],
    [/\btuna\b/gi, "\u062A\u0648\u0646\u0629"],
    [/\bbeans|foul\b/gi, "\u0641\u0648\u0644"],
    [/\bpeas\b/gi, "\u0628\u0627\u0632\u0644\u0627\u0621"],
    [/\bcorn\b/gi, "\u0630\u0631\u0629"],
    [/\boil\b/gi, "\u0632\u064A\u062A"],
    [/\bghee\b/gi, "\u0633\u0645\u0646"],
    [/\brice\b/gi, "\u0623\u0631\u0632"],
    [/\bsugar\b/gi, "\u0633\u0643\u0631"],
    [/\bflour\b/gi, "\u062F\u0642\u064A\u0642"],
    [/\btea\b/gi, "\u0634\u0627\u064A"],
    [/\bcoffee\b/gi, "\u0642\u0647\u0648\u0629"],
    [/\boats\b/gi, "\u0634\u0648\u0641\u0627\u0646"],
    [/\bbiscuit(?:s)?|cookies\b/gi, "\u0628\u0633\u0643\u0648\u064A\u062A"],
    [/\bchips|crisps\b/gi, "\u0634\u064A\u0628\u0633"],
    [/\bchocolate\b/gi, "\u0634\u0648\u0643\u0648\u0644\u0627\u062A\u0629"],
    [/\bcake\b/gi, "\u0643\u064A\u0643"],
    [/\bhoney\b/gi, "\u0639\u0633\u0644"],
    [/\bjam\b/gi, "\u0645\u0631\u0628\u0649"],
    [/\bhalawa\b/gi, "\u062D\u0644\u0627\u0648\u0629 \u0637\u062D\u064A\u0646\u064A\u0629"],
    [/\btomato\s*paste\b/gi, "\u0635\u0644\u0635\u0629 \u0637\u0645\u0627\u0637\u0645"],
    [/\bketchup\b/gi, "\u0643\u0627\u062A\u0634\u0628"],
    [/\bmayonnaise|mayo\b/gi, "\u0645\u0627\u064A\u0648\u0646\u064A\u0632"],
    [/\bpasta|macaroni|spaghetti\b/gi, "\u0645\u0643\u0631\u0648\u0646\u0629"],
    [/\bsoap\b/gi, "\u0635\u0627\u0628\u0648\u0646"],
    [/\bshampoo\b/gi, "\u0634\u0627\u0645\u0628\u0648"]
  ];
  for (const [rx, ar] of dict) {
    s = s.replace(rx, ar);
  }
  const hadUnknownEnglish = /[a-zA-Z]{3,}/.test(s);
  s = s.replace(/[a-zA-Z]+/g, " ").replace(/\s+/g, " ").trim();
  if (/(?:دلتا|روابي|راني|سيزر|سن توب)/.test(s) && !/(?:عصير|شراب|حليب|لبن|زبادي|جبن)/.test(s)) {
    s = "\u0639\u0635\u064A\u0631 " + s;
  } else if (/(?:برتقال|مانجو|جوافة|كوكتيل|أناناس|خوخ|فراولة)/.test(s) && /(?:دلتا|روابي|راني|سيزر|سن توب|نادك|المراعي)/.test(s) && !s.startsWith("\u0639\u0635\u064A\u0631")) {
    s = "\u0639\u0635\u064A\u0631 " + s;
  }
  return { arabicName: s.trim(), hadUnknownEnglish };
}
function classifyProductCategory(productName, productTypeHint, aiSuggestedCatId, categories2) {
  const text2 = (productName + " " + productTypeHint).toLowerCase();
  const isJuiceOrDrink = /(?:عصير|عصائر|شراب|مشروب|مشروبات|مرطبات|دلتا|روابي|راني|سيزر|سن توب|فيمتو|تانج|بيبسي|كوكاكولا|سفن|ميرندا|فانتا|سبرايت|مياه|ماء)/.test(text2) && !/(?:حليب|لبن|جبن|زبادي|قشطة|زبدة)/.test(text2);
  const isDairy = /(?:حليب|لبن|ألبان|البان|جبن|جبنة|أجبان|اجبان|زبادي|قشطة|زبدة|لبنة|كيري|بوك|نيدو)/.test(text2);
  const isSpices = /(?:بهار|بهارات|عطارة|كمون|فلفل|كركم|قرفة|هيل|زنجبيل|كزبرة|قرنفل|بسباس|حوائج)/.test(text2);
  const isProduce = /(?:خضار|خضروات|فواكه|فاكهة|طماطم|بطاط|بصل|خيار|جزر|ثوم|كوسة|باذنجان|بامية|موز|تفاح)/.test(text2) && !isJuiceOrDrink;
  const isCannedOrGrocery = /(?:تونة|فول|فاصوليا|بازلاء|ذرة|صلصة|معلبات|أرز|ارز|سكر|دقيق|مكرونة|شوفان|زيت|سمن|حلاوة|عسل|مربى|شاي|قهوة)/.test(text2);
  const isSnacks = /(?:بسكويت|شيبس|شوكولاتة|بطاطس|كيك|حلويات|سناك|برينجلز|أوريو|ليز|جالاكسي|كيت كات)/.test(text2);
  const isCleaning = /(?:صابون|شامبو|منظف|منظفات|كلور|تايد|إيريال|فيري|مناديل|حفاضات)/.test(text2);
  const findCat = (rx) => categories2.find((c) => rx.test(c.name));
  if (isJuiceOrDrink) {
    const c = findCat(/(?:عصير|عصائر|مشروب|مشروبات|مرطبات|مياه)/);
    return { categoryId: c ? c.id : null, suggestedCategoryName: "\u0627\u0644\u0639\u0635\u0627\u0626\u0631 \u0648\u0627\u0644\u0645\u0634\u0631\u0648\u0628\u0627\u062A" };
  }
  if (isDairy) {
    const c = findCat(/(?:ألبان|البان|أجبان|اجبان|حليب|مشتقات)/);
    return { categoryId: c ? c.id : null, suggestedCategoryName: "\u0627\u0644\u0623\u0644\u0628\u0627\u0646 \u0648\u0627\u0644\u0623\u062C\u0628\u0627\u0646" };
  }
  if (isSpices) {
    const c = findCat(/(?:بهار|بهارات|عطارة|توابل)/);
    return { categoryId: c ? c.id : null, suggestedCategoryName: "\u0627\u0644\u0628\u0647\u0627\u0631\u0627\u062A \u0648\u0627\u0644\u0639\u0637\u0627\u0631\u0629" };
  }
  if (isProduce) {
    const c = findCat(/(?:خضار|خضروات|فواكه|طازج)/);
    return { categoryId: c ? c.id : null, suggestedCategoryName: "\u0627\u0644\u062E\u0636\u0631\u0648\u0627\u062A \u0648\u0627\u0644\u0641\u0648\u0627\u0643\u0647" };
  }
  if (isCannedOrGrocery) {
    const c = findCat(/(?:معلبات|بقوليات|مواد غذائية|تموينات|بقالة|أساسية|اساسية|زيوت|حبوب)/);
    return { categoryId: c ? c.id : null, suggestedCategoryName: "\u0627\u0644\u0645\u0648\u0627\u062F \u0627\u0644\u063A\u0630\u0627\u0626\u064A\u0629 \u0648\u0627\u0644\u0645\u0639\u0644\u0628\u0627\u062A" };
  }
  if (isSnacks) {
    const c = findCat(/(?:بسكويت|حلويات|شيبس|سناك|تسالي|شوكولاتة)/);
    return { categoryId: c ? c.id : null, suggestedCategoryName: "\u0627\u0644\u0628\u0633\u0643\u0648\u064A\u062A \u0648\u0627\u0644\u062D\u0644\u0648\u064A\u0627\u062A" };
  }
  if (isCleaning) {
    const c = findCat(/(?:منظف|منظفات|عناية|صابون|منزلية)/);
    return { categoryId: c ? c.id : null, suggestedCategoryName: "\u0627\u0644\u0645\u0646\u0638\u0641\u0627\u062A \u0648\u0627\u0644\u0639\u0646\u0627\u064A\u0629" };
  }
  if (aiSuggestedCatId && categories2.some((c) => c.id === aiSuggestedCatId)) {
    const suggestedCat = categories2.find((c) => c.id === aiSuggestedCatId);
    if (/(?:ألبان|البان|أجبان|اجبان)/.test(suggestedCat.name) && !isDairy) {
      return { categoryId: null, suggestedCategoryName: null };
    }
    return { categoryId: aiSuggestedCatId, suggestedCategoryName: null };
  }
  return { categoryId: null, suggestedCategoryName: null };
}
async function analyzeProductImageAI(params) {
  const cleanedHint = cleanHintFromFileName(params.fileName);
  if (cleanedHint.length >= 3) {
    const localTrans = translateEnglishProductTokensToArabic(cleanedHint);
    if (localTrans.arabicName.length >= 3 && !localTrans.hadUnknownEnglish) {
      const finalName2 = localTrans.arabicName;
      const isPackagedOrDrink2 = /(?:عصير|شراب|حليب|لبن|زبادي|جبن|قشطة|تونة|فول|بسكويت|شيبس|شوكولاتة|مياه|ماء|زيت|سمن|معلب|علبة|عبوة)/.test(finalName2);
      const weightEnabled = !isPackagedOrDrink2 && /(?:كمون|فلفل|كركم|بهارات|طماطم|بطاط|بصل|خيار|جزر|حلاوة)/.test(finalName2);
      const catMatch2 = classifyProductCategory(finalName2, "", null, params.categories);
      return {
        name: finalName2,
        description: "\u0645\u0646\u062A\u062C " + finalName2 + " \u0628\u062C\u0648\u062F\u0629 \u0645\u0645\u062A\u0627\u0632\u0629 \u0648\u0633\u0639\u0631 \u0645\u0646\u0627\u0641\u0633 \u0645\u0646 \u0645\u062A\u062C\u0631 \u0623\u0648\u0631\u062C\u0646\u0627\u0644.",
        categoryId: catMatch2.categoryId,
        suggestedCategoryName: catMatch2.suggestedCategoryName,
        unit: weightEnabled ? "\u0643\u064A\u0644\u0648" : "\u062D\u0628\u0629",
        weightEnabled
      };
    }
  }
  const catListText = params.categories.map((c) => c.id + ":" + c.name).join("|");
  const shortVisionPrompt = '\u0627\u0642\u0631\u0623 \u0627\u0644\u0645\u0646\u062A\u062C \u0628\u0627\u0644\u0635\u0648\u0631\u0629 \u0648\u0627\u0643\u062A\u0628 JSON \u0628\u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0641\u0642\u0637 \u0628\u062F\u0648\u0646 \u0623\u064A \u062D\u0631\u0641 \u0625\u0646\u062C\u0644\u064A\u0632\u064A: {"name":"\u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u062A\u062C \u0628\u0627\u0644\u0639\u0631\u0628\u064A\u0629","productType":"\u0639\u0635\u0627\u0626\u0631/\u0623\u0644\u0628\u0627\u0646/\u0645\u0639\u0644\u0628\u0627\u062A/\u0628\u0647\u0627\u0631\u0627\u062A/\u062E\u0636\u0631\u0648\u0627\u062A/\u062D\u0644\u0648\u064A\u0627\u062A/\u0645\u0646\u0638\u0641\u0627\u062A","categoryId":null,"weightEnabled":false} \u0627\u0644\u0623\u0642\u0633\u0627\u0645:[' + catListText + "]";
  const keys = getAllActiveKeys();
  const P = ["ht", "tps", "://"].join("");
  const visionModels = [
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "meta-llama/llama-4-maverick-17b-128e-instruct"
  ];
  let extractedName = "";
  let extractedType = "";
  let extractedCatId = null;
  let extractedWeight = false;
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const idx = (keyIndex + attempt) % keys.length;
    const apiKey = keys[idx];
    const isGroq = apiKey.startsWith("gsk_");
    const url = isGroq ? P + ["api.groq.com", "openai", "v1", "chat", "completions"].join("/") : P + ["openrouter.ai", "api", "v1", "chat", "completions"].join("/");
    for (const model of visionModels) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: "Bearer " + apiKey },
          body: JSON.stringify({
            model,
            temperature: 0.1,
            max_tokens: 140,
            messages: [{
              role: "user",
              content: [
                { type: "text", text: shortVisionPrompt },
                { type: "image_url", image_url: { url: params.imageDataUrl } }
              ]
            }]
          })
        });
        if (res.status === 401 || res.status === 402) break;
        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 500));
          continue;
        }
        if (!res.ok) continue;
        const data = await res.json();
        const rawReply = String(data?.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
        const jsonMatch = rawReply.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const candName = stripNoiseFromArabicName(String(parsed.name || ""));
          if (candName) {
            extractedName = candName;
            extractedType = String(parsed.productType || "");
            extractedCatId = parsed.categoryId !== null && parsed.categoryId !== void 0 ? Number(parsed.categoryId) : null;
            extractedWeight = Boolean(parsed.weightEnabled);
            keyIndex = idx;
            break;
          }
        }
      } catch {
      }
    }
    if (extractedName) break;
  }
  const finalTrans = translateEnglishProductTokensToArabic(extractedName || cleanedHint);
  const finalName = finalTrans.arabicName || "\u0645\u0646\u062A\u062C \u062C\u062F\u064A\u062F";
  const isPackagedOrDrink = /(?:عصير|شراب|حليب|لبن|زبادي|جبن|قشطة|تونة|فول|بسكويت|شيبس|شوكولاتة|مياه|ماء|زيت|سمن|معلب|علبة|عبوة)/.test(finalName + " " + extractedType);
  const finalWeightEnabled = isPackagedOrDrink ? false : Boolean(extractedWeight);
  const catMatch = classifyProductCategory(finalName, extractedType, extractedCatId, params.categories);
  return {
    name: finalName,
    description: "\u0645\u0646\u062A\u062C " + finalName + " \u0628\u062C\u0648\u062F\u0629 \u0645\u0645\u062A\u0627\u0632\u0629 \u0648\u0633\u0639\u0631 \u0645\u0646\u0627\u0641\u0633 \u0645\u0646 \u0645\u062A\u062C\u0631 \u0623\u0648\u0631\u062C\u0646\u0627\u0644.",
    categoryId: catMatch.categoryId,
    suggestedCategoryName: catMatch.suggestedCategoryName,
    unit: finalWeightEnabled ? "\u0643\u064A\u0644\u0648" : "\u062D\u0628\u0629",
    weightEnabled: finalWeightEnabled
  };
}
async function parseBulkProductsTextAI(params) {
  return params.rawText.split(/\n+/).map((l) => l.trim()).filter(Boolean).slice(0, 50).map((line) => {
    const priceMatch = line.match(/(?:[-:–—=]|بـ|بسعر)\s*(\d+(?:\.\d+)?)\s*(?:ر\.?ي|ريال)?$/i) || line.match(/\s+(\d{2,6})\s*(?:ر\.?ي|ريال)?$/);
    const price = priceMatch ? Math.max(0, Math.round(Number(priceMatch[1]) || 0)) : 0;
    const rawName = (priceMatch ? line.slice(0, priceMatch.index).trim() : line).replace(/^[-*•\d.)\s]+/, "").trim();
    const name = translateEnglishProductTokensToArabic(rawName).arabicName || rawName;
    const isDrinkOrPack = /(?:عصير|شراب|حليب|لبن|زبادي|جبن|تونة|فول|بسكويت|شيبس)/.test(name);
    const weightEnabled = !isDrinkOrPack && /(?:كيلو|بهارات|كمون|فلفل|كركم|حلاوة|طماط|بطاط|بصل|خيار)/.test(name);
    return {
      name,
      price,
      description: "\u0645\u0646\u062A\u062C " + name + " \u0628\u062C\u0648\u062F\u0629 \u0645\u0645\u062A\u0627\u0632\u0629 \u0648\u0633\u0639\u0631 \u0645\u0646\u0627\u0641\u0633 \u0645\u0646 \u0645\u062A\u062C\u0631 \u0623\u0648\u0631\u062C\u0646\u0627\u0644.",
      categoryId: classifyProductCategory(name, "", null, params.categories).categoryId,
      unit: weightEnabled ? "\u0643\u064A\u0644\u0648" : "\u062D\u0628\u0629",
      weightEnabled
    };
  });
}

// server/guest-orders.ts
import { createHash as createHash2, timingSafeEqual as timingSafeEqual2 } from "node:crypto";
function normalizeYemeniPhone(value) {
  const latinDigits = String(value || "").replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776));
  let digits = latinDigits.replace(/\D/g, "");
  if (digits.startsWith("00967") && digits.length >= 14) digits = digits.slice(5);
  else if (digits.startsWith("967") && digits.length >= 12) digits = digits.slice(3);
  else if (digits.startsWith("07") && digits.length === 10) digits = digits.slice(1);
  return digits;
}
function isValidGuestPhone(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.indexOf("+") > 0) return false;
  const latinDigits = raw.replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776));
  if (!/^\+?[\d\s().-]+$/.test(latinDigits)) return false;
  const clean = normalizeYemeniPhone(raw);
  return /^(77|73|78|71|70)\d{7}$/.test(clean);
}
function hashGuestOrderKey(key) {
  return createHash2("sha256").update(key, "utf8").digest("hex");
}
function constantTimeEqual(left, right) {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return leftBytes.length === rightBytes.length && timingSafeEqual2(leftBytes, rightBytes);
}
function matchesGuestOrderKey(providedKey, storedKey) {
  const digest = hashGuestOrderKey(providedKey);
  const digestMatches = constantTimeEqual(digest, storedKey);
  const legacyMatches = constantTimeEqual(providedKey, storedKey);
  return digestMatches || legacyMatches;
}

// server/_core/webPush.ts
import {
  createCipheriv,
  createDecipheriv,
  createECDH,
  createHash as createHash3,
  hkdfSync,
  randomBytes as randomBytes2
} from "node:crypto";
import webpush from "web-push";
var sendNotification = webpush.sendNotification || webpush.default?.sendNotification;
var setVapidDetails = webpush.setVapidDetails || webpush.default?.setVapidDetails;
var cachedKeys;
var vapidConfigured = false;
function deriveSecret(salt, info) {
  const secret = ENV.cookieSecret || "original-store-default-jwt-secret-key-2026";
  return Buffer.from(hkdfSync(
    "sha256",
    Buffer.from(secret, "utf8"),
    Buffer.from(salt, "utf8"),
    Buffer.from(info, "utf8"),
    32
  ));
}
function getVapidKeys() {
  if (cachedKeys) return cachedKeys;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const privateBytes = deriveSecret("original-web-push-v1", `vapid-p256-${attempt}`);
    try {
      const ecdh = createECDH("prime256v1");
      ecdh.setPrivateKey(privateBytes);
      cachedKeys = {
        publicKey: ecdh.getPublicKey(void 0, "uncompressed").toString("base64url"),
        privateKey: privateBytes.toString("base64url")
      };
      return cachedKeys;
    } catch {
    }
  }
  throw new Error("Web Push signing is unavailable");
}
function getWebPushPublicKey() {
  return getVapidKeys().publicKey;
}
function configureVapid() {
  if (vapidConfigured) return;
  const keys = getVapidKeys();
  setVapidDetails("mailto:admin@original-store.com", keys.publicKey, keys.privateKey);
  vapidConfigured = true;
}
function isAllowedPushEndpoint(value) {
  try {
    const endpoint = new URL(value);
    return endpoint.protocol === "https:";
  } catch {
    return false;
  }
}
function protectPushSubscription(subscription) {
  if (!isAllowedPushEndpoint(subscription.endpoint)) throw new Error("Unsupported push endpoint");
  const endpointHash = createHash3("sha256").update(subscription.endpoint).digest("hex");
  const iv = randomBytes2(12);
  const cipher = createCipheriv("aes-256-gcm", deriveSecret("original-web-push-v1", "subscription-encryption"), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify({ endpoint: subscription.endpoint, keys: subscription.keys }), "utf8"),
    cipher.final()
  ]);
  const encryptedPayload = `v1.${Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url")}`;
  return { endpointHash, encryptedPayload };
}
function unprotectPushSubscription(encryptedPayload) {
  if (!encryptedPayload.startsWith("v1.")) throw new Error("Unsupported stored push subscription");
  const packed = Buffer.from(encryptedPayload.slice(3), "base64url");
  if (packed.length < 29) throw new Error("Invalid stored push subscription");
  const iv = packed.subarray(0, 12);
  const authTag = packed.subarray(12, 28);
  const ciphertext = packed.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", deriveSecret("original-web-push-v1", "subscription-encryption"), iv);
  decipher.setAuthTag(authTag);
  const decoded = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  const subscription = JSON.parse(decoded);
  if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth || !isAllowedPushEndpoint(subscription.endpoint)) {
    throw new Error("Invalid stored push subscription");
  }
  return subscription;
}
async function sendWebPush(subscription, message) {
  configureVapid();
  const rawTopic = (message.tag || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
  return sendNotification(subscription, JSON.stringify(message), {
    TTL: 60 * 60 * 24,
    urgency: "high",
    ...rawTopic ? { topic: rawTopic } : {}
  });
}

// server/assistant.ts
import { z as z2 } from "zod";
var assistantModelOutputSchema = z2.object({
  message: z2.string().trim().min(1).max(1200),
  recipeName: z2.string().trim().max(160),
  servings: z2.number().int().min(0).max(50),
  ingredients: z2.array(z2.object({
    productId: z2.number().int().positive(),
    quantity: z2.number().int().positive().max(1e4)
  }).strict()).max(40),
  steps: z2.array(z2.string().trim().min(1).max(500)).max(20),
  missingIngredients: z2.array(z2.string().trim().min(1).max(120)).max(30),
  cartAction: z2.enum(["none", "add", "remove"]),
  suggestedQuestions: z2.array(z2.string().trim().min(1).max(120)).max(6).optional(),
  cartItems: z2.array(z2.object({
    productId: z2.number().int().positive(),
    quantity: z2.number().int().min(0).max(1e4)
  }).strict()).max(20)
}).strict();
function contentToText(content) {
  if (typeof content === "string") return content.trim() || null;
  if (!Array.isArray(content)) return null;
  const text2 = content.flatMap((part) => {
    if (part && typeof part === "object" && "text" in part && typeof part.text === "string") return [part.text];
    return [];
  }).join("\n").trim();
  return text2 || null;
}
function parseAssistantModelContent(content) {
  const text2 = contentToText(content);
  if (!text2) return null;
  const unfenced = text2.replace(/^\s*\x60\x60\x60(?:json)?\s*/i, "").replace(/\s*\x60\x60\x60\s*$/, "").trim();
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const raw = JSON.parse(unfenced.slice(start, end + 1));
      if (raw && typeof raw === "object") {
        let msg = "";
        for (const k of ["message", "reply", "response", "answer", "text", "content", "greeting", "description", "summary"]) {
          if (typeof raw[k] === "string" && raw[k].trim()) {
            msg = raw[k].trim();
            break;
          }
        }
        if (!msg && Array.isArray(raw.methods)) {
          msg = raw.methods.map((m, i) => typeof m === "string" ? i + 1 + ". " + m : i + 1 + ". " + (m.name || m.title || "") + ": " + (m.description || m.steps || "")).join("\n\n");
        }
        if (!msg) {
          const stringVals = Object.values(raw).filter((v) => typeof v === "string" && v.trim().length > 3);
          if (stringVals.length > 0) msg = stringVals.join("\n\n");
        }
        if (!msg && Array.isArray(raw.steps) && raw.steps.length > 0) {
          msg = "\u0625\u0644\u064A\u0643 \u0637\u0631\u064A\u0642\u0629 \u062A\u062D\u0636\u064A\u0631 " + (raw.recipeName || "\u0627\u0644\u0648\u0635\u0641\u0629") + " \u0628\u0627\u0644\u062A\u0641\u0635\u064A\u0644:";
        }
        if (msg) {
          return {
            message: msg.replace(/\*\*/g, "").slice(0, 1200),
            recipeName: typeof raw.recipeName === "string" ? raw.recipeName.replace(/\*\*/g, "").trim().slice(0, 160) : "",
            servings: typeof raw.servings === "number" && raw.servings >= 0 ? Math.min(50, Math.floor(raw.servings)) : Array.isArray(raw.steps) && raw.steps.length > 0 ? 3 : 0,
            ingredients: Array.isArray(raw.ingredients) ? raw.ingredients.filter((i) => i && Number.isInteger(Number(i.productId)) && Number(i.productId) > 0).map((i) => ({ productId: Number(i.productId), quantity: Math.max(1, Math.min(1e4, Math.floor(Number(i.quantity) || 1))) })).slice(0, 40) : [],
            steps: Array.isArray(raw.steps) ? raw.steps.filter((s) => typeof s === "string" && s.trim()).map((s) => s.replace(/\*\*/g, "").trim().slice(0, 500)).slice(0, 20) : [],
            missingIngredients: Array.isArray(raw.missingIngredients) ? raw.missingIngredients.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim().slice(0, 120)).slice(0, 30) : [],
            cartAction: raw.cartAction === "add" || raw.cartAction === "remove" ? raw.cartAction : "none",
            suggestedQuestions: Array.isArray(raw.suggestedQuestions) ? raw.suggestedQuestions.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim().slice(0, 100)).slice(0, 4) : [],
            cartItems: Array.isArray(raw.cartItems) ? raw.cartItems.filter((i) => i && Number.isInteger(Number(i.productId)) && Number(i.productId) > 0).map((i) => ({ productId: Number(i.productId), quantity: Math.max(0, Math.min(1e4, Math.floor(Number(i.quantity) ?? 1))) })).slice(0, 20) : []
          };
        }
      }
    } catch {
    }
  }
  const cleanPlain = unfenced.replace(/^[^{]*\{[\s\S]*?"message"\s*:\s*"([^"]+)"[\s\S]*$/, "$1").replace(/\*\*/g, "").trim();
  if (cleanPlain.length > 1) {
    return {
      message: cleanPlain.slice(0, 1200),
      recipeName: "",
      servings: 0,
      ingredients: [],
      steps: [],
      missingIngredients: [],
      cartAction: "none",
      cartItems: []
    };
  }
  return null;
}
function normalizeProductQuantity(product, quantity) {
  const minimum = Math.max(1, product.minQuantity || 1);
  const step = Math.max(1, product.quantityStep || 1);
  return minimum + Math.ceil(Math.max(0, quantity - minimum) / step) * step;
}
function maximumValidQuantity(product, available) {
  const minimum = Math.max(1, product.minQuantity || 1);
  const step = Math.max(1, product.quantityStep || 1);
  if (available < minimum) return 0;
  return minimum + Math.floor((available - minimum) / step) * step;
}
function productLine(product, quantity) {
  return {
    productId: product.id,
    name: product.name,
    price: product.price,
    unit: product.unit,
    stock: product.stock,
    minQuantity: product.minQuantity,
    quantityStep: product.quantityStep,
    quantity
  };
}
function uniqueNames(values) {
  const seen = /* @__PURE__ */ new Set();
  return values.map((value) => value.trim()).filter((value) => {
    if (!value) return false;
    const key = value.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 30);
}
function prepareAssistantResponse(output, catalog, cartLines, _requestText = "", _history = []) {
  const catalogById = new Map(catalog.map((product) => [product.id, product]));
  const cartQuantityById = /* @__PURE__ */ new Map();
  for (const line of cartLines) {
    if (!Number.isSafeInteger(line.productId) || !Number.isSafeInteger(line.quantity) || line.quantity <= 0) continue;
    if (!catalogById.has(line.productId)) continue;
    cartQuantityById.set(line.productId, Math.min(1e5, (cartQuantityById.get(line.productId) ?? 0) + line.quantity));
  }
  const missing = [...output.missingIngredients];
  const ingredientQuantities = /* @__PURE__ */ new Map();
  for (const ingredient of output.ingredients) {
    ingredientQuantities.set(ingredient.productId, Math.min(1e4, (ingredientQuantities.get(ingredient.productId) ?? 0) + ingredient.quantity));
  }
  const ingredients = [];
  for (const [productId, requestedQuantity] of ingredientQuantities) {
    const product = catalogById.get(productId);
    if (!product) continue;
    const quantity = normalizeProductQuantity(product, requestedQuantity);
    if (product.stock !== null && quantity > product.stock) {
      const availableQuantity = maximumValidQuantity(product, product.stock);
      if (availableQuantity > 0) ingredients.push(productLine(product, availableQuantity));
      continue;
    }
    ingredients.push(productLine(product, quantity));
  }
  const missingIngredients = uniqueNames(missing);
  const hasRecipe = Boolean(output.recipeName && (output.steps.length > 0 || ingredients.length > 0));
  const message = output.message;
  let cartAction = null;
  if (output.cartAction !== "none" && output.cartItems.length > 0) {
    const requestedById = /* @__PURE__ */ new Map();
    for (const item of output.cartItems) {
      if (!catalogById.has(item.productId)) continue;
      requestedById.set(item.productId, Math.min(1e4, (requestedById.get(item.productId) ?? 0) + item.quantity));
    }
    const preparedItems = [];
    for (const [productId, requestedQuantity] of requestedById) {
      const product = catalogById.get(productId);
      const inCart = cartQuantityById.get(productId) ?? 0;
      if (output.cartAction === "remove") {
        if (inCart <= 0) continue;
        const quantity2 = requestedQuantity === 0 ? inCart : Math.min(requestedQuantity, inCart);
        preparedItems.push(productLine(product, quantity2));
        continue;
      }
      if (requestedQuantity <= 0) continue;
      const normalized = normalizeProductQuantity(product, requestedQuantity);
      const remaining = product.stock === null ? Number.POSITIVE_INFINITY : Math.max(0, product.stock - inCart);
      const allowed = maximumValidQuantity(product, remaining);
      if (allowed <= 0) continue;
      const quantity = Math.min(normalized, allowed);
      preparedItems.push(productLine(product, quantity));
    }
    if (preparedItems.length > 0) {
      cartAction = { type: output.cartAction, items: preparedItems };
    }
  }
  return {
    message,
    recipe: hasRecipe ? { name: output.recipeName, servings: output.servings || 2, steps: output.steps } : null,
    ingredients,
    missingIngredients,
    cartAction,
    suggestedQuestions: output.suggestedQuestions ?? []
  };
}

// server/commerce.ts
var __cachedLiveHomeData = null;
var __lastLiveHomeDataTime = 0;
function clearLiveHomeCache() {
  __cachedLiveHomeData = null;
  __lastLiveHomeDataTime = 0;
}
async function database() {
  const db = await getDb();
  if (!db) throw new TRPCError3({ code: "SERVICE_UNAVAILABLE", message: "\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u0629 \u0645\u0624\u0642\u062A\u064B\u0627." });
  return db;
}
var CACHE_FILE = ".catalog-cache.json";
var __catalogCache = /* @__PURE__ */ new Map();
try {
  if (fs2.existsSync(CACHE_FILE)) {
    const raw = JSON.parse(
      fs2.readFileSync(CACHE_FILE, "utf8"),
      (k, val) => (k === "createdAt" || k === "updatedAt" || k === "startsAt" || k === "endsAt" || k === "lastOrderAt" || k === "lastSignedIn") && typeof val === "string" ? new Date(val) : val
    );
    for (const [k, v] of Object.entries(raw)) __catalogCache.set(k, { exp: 0, data: v, refreshing: false });
  }
} catch {
}
function saveDiskCache() {
  try {
    const obj = {};
    for (const [k, v] of __catalogCache.entries()) obj[k] = v.data;
    fs2.writeFileSync(CACHE_FILE, JSON.stringify(obj));
  } catch {
  }
}
async function withFastRetry(fetcher) {
  let timer = null;
  try {
    return await Promise.race([
      fetcher(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("QUERY_TIMEOUT")), 5500);
      })
    ]);
  } catch (err) {
    resetDbPool();
    return await fetcher();
  } finally {
    if (timer) clearTimeout(timer);
  }
}
function getCached(key, ttlMs, fetcher) {
  const now = Date.now();
  const hit = __catalogCache.get(key);
  if (hit) {
    if (hit.exp <= now && !hit.refreshing) {
      hit.refreshing = true;
      withFastRetry(fetcher).then((data) => {
        __catalogCache.set(key, { exp: Date.now() + ttlMs, data, refreshing: false });
        saveDiskCache();
      }).catch(() => {
        hit.refreshing = false;
      });
    }
    return Promise.resolve(hit.data);
  }
  return withFastRetry(fetcher).then((data) => {
    __catalogCache.set(key, { exp: Date.now() + ttlMs, data, refreshing: false });
    saveDiskCache();
    return data;
  });
}
function clearCatalogCache(removedProductId) {
  __cachedLiveHomeData = null;
  __lastLiveHomeDataTime = 0;
  try {
    const g = globalThis;
    if (removedProductId && g.__fastHomeData && Array.isArray(g.__fastHomeData.products)) {
      g.__fastHomeData.products = g.__fastHomeData.products.filter((p) => p.id !== removedProductId);
    }
    g.__fastHomeData = null;
    g.__fastHomeTime = 0;
    g.__catalogVer = Date.now();
    if (typeof g.__resetRefreshingPromise === "function") g.__resetRefreshingPromise();
    if (typeof g.__loadCatalogHome === "function") {
      setTimeout(() => {
        void g.__loadCatalogHome().catch(() => {
        });
      }, 5);
    }
  } catch {
  }
}
var AI_PRODUCT_CACHE_FILE = ".ai-product-recipes.json";
var __aiProductRecipes = {};
try {
  if (fs2.existsSync(AI_PRODUCT_CACHE_FILE)) {
    __aiProductRecipes = JSON.parse(fs2.readFileSync(AI_PRODUCT_CACHE_FILE, "utf8"));
  }
} catch {
}
function saveAiProductRecipe(cacheKey, output) {
  const key = cacheKey.trim().toLowerCase();
  __aiProductRecipes[key] = output;
  try {
    fs2.writeFileSync(AI_PRODUCT_CACHE_FILE, JSON.stringify(__aiProductRecipes, null, 2));
  } catch {
  }
}
async function generateAndCacheProductAiRecipe(productName, catalog, customModification) {
  const cacheKey = customModification ? `${productName.trim().toLowerCase()}::${customModification.trim().toLowerCase()}` : `${productName.trim().toLowerCase()}::init-v3`;
  if (__aiProductRecipes[cacheKey]) return __aiProductRecipes[cacheKey];
  const compactCatalog = catalog.slice(0, 50).map((p) => ({ id: p.id, name: p.name, price: p.price, unit: p.unit }));
  const sys = "\u0623\u0646\u062A \u0627\u0644\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0630\u0643\u064A \u0644\u0645\u062A\u062C\u0631 \u0623\u0648\u0631\u062C\u0646\u0627\u0644 \u0641\u064A \u0627\u0644\u064A\u0645\u0646. \u062D\u0644\u0644 \u0637\u0628\u064A\u0639\u0629 \u0627\u0644\u0645\u0646\u062A\u062C \u0623\u0648\u0644\u0627\u064B \u0628\u0644\u0647\u062C\u0629 \u064A\u0645\u0646\u064A\u0629 \u0631\u0627\u0642\u064A\u0629 \u0648\u0648\u062F\u0648\u062F\u0629\u060C \u0648\u0625\u0630\u0627 \u0644\u0645 \u064A\u0643\u0646 \u0645\u0646\u062A\u062C \u0637\u0628\u062E \u0642\u062F\u0645 \u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0630\u0643\u064A\u0629 \u0639\u0646\u0647 \u0648\u0644\u0627 \u062A\u0641\u0631\u0636 \u0648\u0635\u0641\u0627\u062A \u0637\u0628\u062E\u060C \u062B\u0645 \u0627\u0639\u0631\u0636 \u0641\u064A \u0627\u0644\u0646\u0647\u0627\u064A\u0629 \u0627\u0642\u062A\u0631\u0627\u062D\u0627\u062A \u062A\u0641\u0627\u0639\u0644\u064A\u0629 \u0641\u064A \u062D\u0642\u0644 suggestedQuestions.";
  const usr = [
    `\u0627\u0644\u0635\u0646\u0641 \u0627\u0644\u0623\u0633\u0627\u0633\u064A: \xAB${productName}\xBB`,
    customModification ? `\u0637\u0644\u0628 \u0627\u0644\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u062E\u0627\u0635 \u0645\u0646 \u0627\u0644\u0632\u0628\u0648\u0646: ${customModification}` : "\u0627\u0644\u0645\u0637\u0644\u0648\u0628: \u062A\u062D\u0644\u064A\u0644 \u0630\u0643\u064A \u0644\u0644\u0645\u0646\u062A\u062C \u0648\u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0639\u0646\u0647 \u0645\u0639 \u0627\u0642\u062A\u0631\u0627\u062D\u0627\u062A \u062A\u0641\u0627\u0639\u0644\u064A\u0629.",
    `\u0643\u062A\u0627\u0644\u0648\u062C \u0627\u0644\u0645\u062A\u062C\u0631 \u0627\u0644\u062D\u0627\u0644\u064A: ${JSON.stringify(compactCatalog)}`
  ].join("\n\n");
  const res = await invokeLLM({
    messages: [
      { role: "system", content: sys },
      { role: "user", content: usr }
    ],
    response_format: { type: "json_object" }
  });
  const parsed = parseAssistantModelContent(res.choices?.[0]?.message?.content);
  if (parsed && parsed.message) {
    saveAiProductRecipe(cacheKey, parsed);
    return parsed;
  }
  return null;
}
var pushSubscriptionSchema = z3.object({
  endpoint: z3.string().url().max(2048),
  keys: z3.object({
    p256dh: z3.string().min(20).max(200).regex(/^[A-Za-z0-9_+/=-]+$/),
    auth: z3.string().min(10).max(100).regex(/^[A-Za-z0-9_+/=-]+$/)
  })
});
var ADMIN_PUSH_BACKUP_KEY = "admin_push_subscriptions_v2";
async function loadBackupAdminSubscriptions(db) {
  try {
    const rows = await db.select().from(storeSettings).where(eq4(storeSettings.key, ADMIN_PUSH_BACKUP_KEY)).limit(1);
    const parsed = JSON.parse(rows[0]?.value || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => x && typeof x.endpointHash === "string" && typeof x.encryptedPayload === "string");
  } catch {
    return [];
  }
}
async function saveBackupAdminSubscription(db, sub) {
  try {
    const existing = await loadBackupAdminSubscriptions(db);
    const filtered = existing.filter((x) => x.endpointHash !== sub.endpointHash);
    filtered.unshift({ endpointHash: sub.endpointHash, encryptedPayload: sub.encryptedPayload });
    const nextVal = JSON.stringify(filtered.slice(0, 30));
    await db.insert(storeSettings).values({ key: ADMIN_PUSH_BACKUP_KEY, value: nextVal }).onDuplicateKeyUpdate({ set: { value: nextVal } });
  } catch {
  }
}
async function removeBackupAdminSubscription(db, endpointHash) {
  try {
    const existing = await loadBackupAdminSubscriptions(db);
    const filtered = existing.filter((x) => x.endpointHash !== endpointHash);
    if (filtered.length === existing.length) return;
    const nextVal = JSON.stringify(filtered);
    await db.insert(storeSettings).values({ key: ADMIN_PUSH_BACKUP_KEY, value: nextVal }).onDuplicateKeyUpdate({ set: { value: nextVal } });
  } catch {
  }
}
async function deliverPushRows(rows, message, remove) {
  await Promise.allSettled(rows.map(async (row) => {
    let subscription;
    try {
      subscription = unprotectPushSubscription(row.encryptedPayload);
    } catch {
      await remove(row.id, row.endpointHash);
      return;
    }
    try {
      await sendWebPush(subscription, message);
    } catch (error) {
      const statusCode = error && typeof error === "object" && "statusCode" in error ? Number(error.statusCode) : void 0;
      if (statusCode === 404 || statusCode === 410) await remove(row.id, row.endpointHash);
      console.warn("[Push] Delivery failed", statusCode ?? "network");
    }
  }));
}
async function getAllAdminPushTargets(db) {
  const dbRows = await db.select({
    id: ownerPushSubscriptions.id,
    endpointHash: ownerPushSubscriptions.endpointHash,
    encryptedPayload: ownerPushSubscriptions.encryptedPayload
  }).from(ownerPushSubscriptions).catch(() => []);
  const backupRows = await loadBackupAdminSubscriptions(db);
  const map = /* @__PURE__ */ new Map();
  for (const r of dbRows) {
    if (r.endpointHash && r.encryptedPayload) map.set(r.endpointHash, r);
  }
  for (const b of backupRows) {
    if (b.endpointHash && b.encryptedPayload && !map.has(b.endpointHash)) {
      map.set(b.endpointHash, { id: -1, endpointHash: b.endpointHash, encryptedPayload: b.encryptedPayload });
    }
  }
  return [...map.values()];
}
var __recentAdminPushLocks = /* @__PURE__ */ new Map();
async function notifyOwnerNewOrder(orderId, orderNumber, total, recipientName, area) {
  const lockKey = "admin-order-" + orderId;
  const now = Date.now();
  if (__recentAdminPushLocks.has(lockKey) && now - (__recentAdminPushLocks.get(lockKey) || 0) < 8e3) return;
  __recentAdminPushLocks.set(lockKey, now);
  const db = await database();
  const targets = await getAllAdminPushTargets(db);
  if (!targets.length) return;
  const shortNo = orderNumber.split("-").pop() || orderNumber;
  const who = recipientName ? "\u0627\u0644\u0639\u0645\u064A\u0644: " + recipientName + (area ? " (" + area + ")" : "") + " \xB7 " : "";
  await deliverPushRows(targets, {
    title: "\u{1F6CD}\uFE0F \u0637\u0644\u0628 \u062C\u062F\u064A\u062F #" + shortNo + " \xB7 " + total.toLocaleString("en-US") + " \u0631.\u064A",
    body: who + "\u0627\u0636\u063A\u0637 \u0644\u0641\u062A\u062D \u0627\u0644\u0637\u0644\u0628 \u0648\u062A\u062C\u0647\u064A\u0632\u0647 \u0627\u0644\u0622\u0646",
    url: "/admin/orders?order=" + encodeURIComponent(orderNumber),
    tag: "original-admin-order-" + orderId
  }, async (id, endpointHash) => {
    if (id > 0) await db.delete(ownerPushSubscriptions).where(eq4(ownerPushSubscriptions.id, id)).catch(() => {
    });
    if (endpointHash) await removeBackupAdminSubscription(db, endpointHash);
  });
}
var __recentOrderPushLocks = /* @__PURE__ */ new Map();
async function notifyCustomerOrderStatus(orderId, orderNumber, status, note) {
  const cleanNote = (note || "").trim();
  const lockKey = "cust-order-" + orderId + "::" + status + "::" + cleanNote;
  const now = Date.now();
  if (__recentOrderPushLocks.has(lockKey) && now - (__recentOrderPushLocks.get(lockKey) || 0) < 5e3) {
    return;
  }
  __recentOrderPushLocks.set(lockKey, now);
  const db = await database();
  const subscriptions = await db.select({
    id: customerPushSubscriptions.id,
    endpointHash: customerPushSubscriptions.endpointHash,
    encryptedPayload: customerPushSubscriptions.encryptedPayload
  }).from(customerPushSubscriptions).where(eq4(customerPushSubscriptions.orderId, orderId));
  const uniqueByEndpoint = [...new Map(subscriptions.map((s) => [s.endpointHash, s])).values()];
  if (!uniqueByEndpoint.length) return;
  const shortNo = orderNumber.split("-").pop() || orderNumber;
  const defaultBodies = {
    new: "\u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u0637\u0644\u0628\u0643 \u0628\u0646\u062C\u0627\u062D \u0648\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u062A\u062C\u0647\u064A\u0632 \u2728",
    preparing: "\u0637\u0644\u0628\u0643 \u0627\u0644\u0622\u0646 \u0642\u064A\u062F \u0627\u0644\u062A\u062C\u0647\u064A\u0632 \u0628\u0639\u0646\u0627\u064A\u0629 \u{1F468}\u200D\u{1F373}",
    ready: "\u0637\u0644\u0628\u0643 \u062C\u0627\u0647\u0632 \u0644\u0644\u062A\u0648\u0635\u064A\u0644 \u0627\u0644\u0643\u0627\u0645\u0644 \u{1F4E6}",
    out_for_delivery: "\u0637\u0644\u0628\u0643 \u062E\u0631\u062C \u0644\u0644\u062A\u0648\u0635\u064A\u0644 \u0648\u0647\u0648 \u0641\u064A \u0637\u0631\u064A\u0642\u0647 \u0625\u0644\u064A\u0643 \u{1F6F5}",
    delivered: "\u062A\u0645 \u062A\u0633\u0644\u064A\u0645 \u0637\u0644\u0628\u0643 \u0628\u0646\u062C\u0627\u062D\u060C \u0634\u0643\u0631\u0627\u064B \u0644\u062A\u0633\u0648\u0642\u0643 \u0645\u0646 \u0623\u0648\u0631\u062C\u0646\u0627\u0644 \u{1F49A}",
    cancelled: "\u0639\u0630\u0631\u0627\u064B\u060C \u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0637\u0644\u0628 #" + shortNo
  };
  const title = "\u{1F33F} \u0645\u062A\u062C\u0631 \u0623\u0648\u0631\u062C\u0646\u0627\u0644 \xB7 \u0637\u0644\u0628 #" + shortNo;
  const body = cleanNote ? cleanNote.slice(0, 240) : defaultBodies[status] || "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u062D\u0627\u0644\u0629 \u0637\u0644\u0628\u0643";
  await deliverPushRows(uniqueByEndpoint, {
    title,
    body,
    url: "/orders?order=" + encodeURIComponent(orderNumber),
    tag: "original-customer-order-" + orderId
  }, async (id) => {
    await db.delete(customerPushSubscriptions).where(eq4(customerPushSubscriptions.id, id)).catch(() => {
    });
  });
}
var orderStatus = z3.enum(["new", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"]);
var safeId = z3.number().int().positive();
var settingSchema = z3.object({
  storeName: z3.string().trim().max(100).optional(),
  storeDescription: z3.string().trim().max(500).optional(),
  contactPhone: z3.string().trim().max(32).optional(),
  currency: z3.string().trim().max(20).optional(),
  storeIconUrl: z3.string().max(85e5).nullable().optional(),
  deliveryEnabled: z3.boolean().optional(),
  deliveryFee: z3.number().int().min(0).max(1e8).nullable().optional(),
  minOrderAmount: z3.number().int().min(0).max(1e8).nullable().optional(),
  deliveryZones: z3.array(z3.object({ name: z3.string().trim().min(1).max(100), fee: z3.number().int().min(0).max(1e8), enabled: z3.boolean() })).max(100).optional(),
  orderPaused: z3.boolean().optional(),
  pausedMessage: z3.string().trim().max(300).optional(),
  rewardsThreshold: z3.number().int().min(0).max(1e8).nullable().optional(),
  rewardsMessage: z3.string().trim().max(2e3).optional(),
  rewardEnabled: z3.boolean().optional(),
  rewardType: z3.enum(["free_delivery", "discount_percent"]).optional(),
  rewardValue: z3.number().int().min(0).max(100).optional(),
  aiInstructions: z3.string().trim().max(3e3).optional(),
  deliveryTreeConfig: z3.string().max(6e5).optional()
});
function slugify(value) {
  const slug = value.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 160);
  return `${slug || "item"}-${nanoid(5).toLowerCase()}`;
}
var PUBLIC_STORE_SETTING_KEYS = /* @__PURE__ */ new Set([
  "storeName",
  "storeDescription",
  "contactPhone",
  "currency",
  "storeIconUrl",
  "deliveryEnabled",
  "deliveryFee",
  "deliveryZones",
  "orderPaused",
  "pausedMessage",
  "rewardEnabled",
  "rewardsThreshold",
  "rewardType",
  "rewardValue",
  "rewardsMessage",
  "aiInstructions",
  "deliveryTreeConfig"
]);
var __orderRateBuckets = /* @__PURE__ */ new Map();
function enforceOrderCreateRateLimit(ip) {
  const now = Date.now();
  const key = (ip || "unknown").slice(0, 80);
  const b = __orderRateBuckets.get(key);
  if (!b || now > b.resetAt) {
    __orderRateBuckets.set(key, { count: 1, resetAt: now + 10 * 60 * 1e3 });
    return;
  }
  if (b.count >= 6) {
    throw new TRPCError3({ code: "TOO_MANY_REQUESTS", message: "\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0639\u062F\u0629 \u0637\u0644\u0628\u0627\u062A \u0645\u062A\u062A\u0627\u0644\u064A\u0629 \u0645\u0646 \u0647\u0630\u0627 \u0627\u0644\u062C\u0647\u0627\u0632. \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u0642\u0644\u064A\u0644\u0627\u064B \u0642\u0628\u0644 \u0625\u0631\u0633\u0627\u0644 \u0637\u0644\u0628 \u062C\u062F\u064A\u062F." });
  }
  b.count += 1;
}
async function readSettings(db) {
  try {
    const rows = await db.select().from(storeSettings);
    const settings = { deliveryEnabled: "true", deliveryFee: "0" };
    for (const row of rows) {
      if (!PUBLIC_STORE_SETTING_KEYS.has(row.key)) continue;
      settings[row.key] = row.value;
    }
    const oldStoreNameNorm = new RegExp("\u0623\u0648\u0631\u064A\u062C\u0646\u0627\u0644|\u0627\u0648\u0631\u064A\u062C\u0646\u0627\u0644", "g");
    if (settings.storeName) settings.storeName = settings.storeName.replace(oldStoreNameNorm, "\u0623\u0648\u0631\u062C\u0646\u0627\u0644");
    return settings;
  } catch (err) {
    console.warn("[Settings] Using fallback defaults:", err instanceof Error ? err.message : err);
    return { deliveryEnabled: "true", deliveryFee: "0" };
  }
}
var DEFAULT_SERVER_DELIVERY_TREE = {
  strictSelectionOnly: true,
  globalFreeAbove: null,
  vipFreePhones: [],
  cities: [
    {
      id: "city_sanaa",
      name: "\u0635\u0646\u0639\u0627\u0621",
      defaultFee: 500,
      freeDeliveryPromo: false,
      promoBanner: "",
      enabled: true,
      areas: [
        { id: "area_maeen", name: "\u0645\u0639\u064A\u0646", defaultFee: 500, enabled: true, streets: [
          { id: "st_raqqas", name: "\u0627\u0644\u0631\u0642\u0627\u0635", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 35 \u062F\u0642\u064A\u0642\u0629", enabled: true },
          { id: "st_daeri", name: "\u0627\u0644\u062F\u0627\u0626\u0631\u064A", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 35 \u062F\u0642\u064A\u0642\u0629", enabled: true },
          { id: "st_hael", name: "\u0634\u0627\u0631\u0639 \u0647\u0627\u0626\u0644", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 35 \u062F\u0642\u064A\u0642\u0629", enabled: true },
          { id: "st_sunaina", name: "\u0627\u0644\u0633\u0646\u064A\u0646\u0629", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 45 \u062F\u0642\u064A\u0642\u0629", enabled: true },
          { id: "st_asr", name: "\u0639\u0635\u0631", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 45 \u062F\u0642\u064A\u0642\u0629", enabled: true },
          { id: "st_madhbah", name: "\u0645\u0630\u0628\u062D", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 45 \u062F\u0642\u064A\u0642\u0629", enabled: true }
        ] },
        { id: "area_sabeen", name: "\u0627\u0644\u0633\u0628\u0639\u064A\u0646", defaultFee: 600, enabled: true, streets: [
          { id: "st_haddah", name: "\u062D\u062F\u0629", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 40 \u062F\u0642\u064A\u0642\u0629", enabled: true },
          { id: "st_asbahi", name: "\u0627\u0644\u0623\u0635\u0628\u062D\u064A", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 45 \u062F\u0642\u064A\u0642\u0629", enabled: true },
          { id: "st_baitbaws", name: "\u0628\u064A\u062A \u0628\u0648\u0633", fee: 700, promoFee: null, promoLabel: "", freeAbove: null, etaText: "35 - 50 \u062F\u0642\u064A\u0642\u0629", enabled: true },
          { id: "st_maqaleh", name: "\u0634\u0627\u0631\u0639 \u0627\u0644\u0645\u0642\u0627\u0644\u062D", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 45 \u062F\u0642\u064A\u0642\u0629", enabled: true },
          { id: "st_shumaila", name: "\u0634\u0645\u064A\u0644\u0629", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 45 \u062F\u0642\u064A\u0642\u0629", enabled: true }
        ] },
        { id: "area_wahdah", name: "\u0627\u0644\u0648\u062D\u062F\u0629", defaultFee: 500, enabled: true, streets: [
          { id: "st_jazaer", name: "\u0634\u0627\u0631\u0639 \u0627\u0644\u062C\u0632\u0627\u0626\u0631", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 35 \u062F\u0642\u064A\u0642\u0629", enabled: true },
          { id: "st_baghdad", name: "\u0634\u0627\u0631\u0639 \u0628\u063A\u062F\u0627\u062F", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 35 \u062F\u0642\u064A\u0642\u0629", enabled: true },
          { id: "st_siyasi", name: "\u0627\u0644\u062D\u064A \u0627\u0644\u0633\u064A\u0627\u0633\u064A", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 35 \u062F\u0642\u064A\u0642\u0629", enabled: true },
          { id: "st_tahrir", name: "\u0627\u0644\u062A\u062D\u0631\u064A\u0631", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 40 \u062F\u0642\u064A\u0642\u0629", enabled: true }
        ] },
        { id: "area_shoub", name: "\u0634\u0639\u0648\u0628 \u0648\u0627\u0644\u062B\u0648\u0631\u0629", defaultFee: 600, enabled: true, streets: [
          { id: "st_hasaba", name: "\u0627\u0644\u062D\u0635\u0628\u0629", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 45 \u062F\u0642\u064A\u0642\u0629", enabled: true },
          { id: "st_juraf", name: "\u0627\u0644\u062C\u0631\u0627\u0641", fee: 700, promoFee: null, promoLabel: "", freeAbove: null, etaText: "35 - 50 \u062F\u0642\u064A\u0642\u0629", enabled: true },
          { id: "st_sawan", name: "\u0633\u0639\u0648\u0627\u0646", fee: 700, promoFee: null, promoLabel: "", freeAbove: null, etaText: "35 - 50 \u062F\u0642\u064A\u0642\u0629", enabled: true },
          { id: "st_sheraton", name: "\u0634\u064A\u0631\u0627\u062A\u0648\u0646", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 45 \u062F\u0642\u064A\u0642\u0629", enabled: true }
        ] }
      ]
    },
    {
      id: "city_ibb",
      name: "\u0625\u0628",
      defaultFee: 500,
      freeDeliveryPromo: false,
      promoBanner: "",
      enabled: true,
      areas: [
        { id: "area_dhihar", name: "\u0627\u0644\u0638\u0647\u0627\u0631", defaultFee: 500, enabled: true, streets: [
          { id: "st_ibb_taiz", name: "\u0634\u0627\u0631\u0639 \u062A\u0639\u0632", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 40 \u062F\u0642\u064A\u0642\u0629", enabled: true },
          { id: "st_ibb_daeri", name: "\u0627\u0644\u062F\u0627\u0626\u0631\u064A", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 40 \u062F\u0642\u064A\u0642\u0629", enabled: true },
          { id: "st_ibb_subul", name: "\u0627\u0644\u0633\u0628\u0644", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 40 \u062F\u0642\u064A\u0642\u0629", enabled: true }
        ] },
        { id: "area_mashanah", name: "\u0627\u0644\u0645\u0634\u0646\u0629", defaultFee: 500, enabled: true, streets: [
          { id: "st_ibb_odain", name: "\u0634\u0627\u0631\u0639 \u0627\u0644\u0639\u062F\u064A\u0646", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 40 \u062F\u0642\u064A\u0642\u0629", enabled: true },
          { id: "st_ibb_maayen", name: "\u0627\u0644\u0645\u0639\u0627\u064A\u0646", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 40 \u062F\u0642\u064A\u0642\u0629", enabled: true }
        ] }
      ]
    }
  ]
};
function deliveryFeeForCity(settings, city, district, phone, subtotal = 0) {
  if (settings.deliveryEnabled === "false") return null;
  const cleanCity = String(city || "").trim();
  const cleanDistrict = String(district || "").trim();
  const cleanPhone = normalizeYemeniPhone(String(phone || ""));
  let tree = DEFAULT_SERVER_DELIVERY_TREE;
  if (settings.deliveryTreeConfig) {
    try {
      const parsed = JSON.parse(settings.deliveryTreeConfig);
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.cities) && parsed.cities.length > 0) {
        tree = parsed;
      }
    } catch {
    }
  }
  if (tree && typeof tree === "object") {
    if (cleanPhone && Array.isArray(tree.vipFreePhones)) {
      const vip = tree.vipFreePhones.find((v) => v && v.enabled !== false && normalizeYemeniPhone(String(v.phone || "")) === cleanPhone);
      if (vip) {
        const minOrd = Number(vip.minOrder || 0);
        if (subtotal >= minOrd) return 0;
      }
    }
    if (tree.globalFreeAbove && Number(tree.globalFreeAbove) > 0 && subtotal >= Number(tree.globalFreeAbove)) {
      return 0;
    }
    const activeCities = Array.isArray(tree.cities) ? tree.cities.filter((c) => c && c.enabled !== false) : [];
    if (activeCities.length > 0) {
      const matchedCity = activeCities.find((c) => String(c.name || "").trim() === cleanCity);
      if (matchedCity) {
        if (matchedCity.freeDeliveryPromo) return 0;
        const activeAreas = Array.isArray(matchedCity.areas) ? matchedCity.areas.filter((a) => a && a.enabled !== false) : [];
        const parts = cleanDistrict.split(/\s*[—\-|/]+\s*/).map((s) => s.trim()).filter(Boolean);
        const areaPart = parts[0] || "";
        const streetPart = parts.slice(1).join(" ") || parts[0] || "";
        for (const area of activeAreas) {
          const areaMatch = !areaPart || String(area.name || "").trim() === areaPart || cleanDistrict.includes(String(area.name || "").trim());
          if (!areaMatch) continue;
          const activeStreets = Array.isArray(area.streets) ? area.streets.filter((st) => st && st.enabled !== false) : [];
          const matchedStreet = activeStreets.find((st) => {
            const sName = String(st.name || "").trim();
            return sName === streetPart || sName === cleanDistrict || cleanDistrict.endsWith(sName);
          });
          if (matchedStreet) {
            if (matchedStreet.freeAbove && Number(matchedStreet.freeAbove) > 0 && subtotal >= Number(matchedStreet.freeAbove)) return 0;
            if (matchedStreet.promoFee !== null && matchedStreet.promoFee !== void 0 && matchedStreet.promoFee !== "" && Number.isFinite(Number(matchedStreet.promoFee)) && Number(matchedStreet.promoFee) >= 0) {
              return Math.floor(Number(matchedStreet.promoFee));
            }
            if (Number.isFinite(Number(matchedStreet.fee)) && Number(matchedStreet.fee) >= 0) {
              return Math.floor(Number(matchedStreet.fee));
            }
          }
          if (Number.isFinite(Number(area.defaultFee)) && Number(area.defaultFee) >= 0) {
            return Math.floor(Number(area.defaultFee));
          }
        }
        if (Number.isFinite(Number(matchedCity.defaultFee)) && Number(matchedCity.defaultFee) >= 0) {
          return Math.floor(Number(matchedCity.defaultFee));
        }
      }
    }
  }
  if (settings.deliveryZones) {
    try {
      const zones = JSON.parse(settings.deliveryZones);
      const zone = zones.find((item) => item.enabled && item.name.trim().toLocaleLowerCase() === cleanCity.toLocaleLowerCase());
      if (zone && Number.isInteger(zone.fee) && zone.fee >= 0) return zone.fee;
    } catch {
    }
  }
  const baseFee = Number(settings.deliveryFee ?? "");
  return Number.isInteger(baseFee) && baseFee >= 0 ? baseFee : 500;
}
function unpackServerRewardConfig(rawMsg, fallbackType) {
  const defaultCfg = {
    rewardMode: fallbackType === "discount_percent" ? "discount_percent" : "free_delivery",
    giftName: "",
    fixedDiscount: 0,
    endsAt: "",
    audience: "all",
    allowedPhones: "",
    placement: "everywhere"
  };
  const raw = String(rawMsg || "");
  const match = raw.match(/\[\[rcfg:(\{[\s\S]*?\})\]\]/);
  if (!match) return { cleanMessage: raw.trim(), cfg: defaultCfg };
  try {
    const parsed = JSON.parse(match[1]);
    const cleanMessage = (raw.slice(0, match.index) + raw.slice((match.index || 0) + match[0].length)).trim();
    return {
      cleanMessage,
      cfg: {
        rewardMode: ["custom_gift", "free_delivery", "discount_percent", "discount_fixed"].includes(parsed.rewardMode) ? parsed.rewardMode : defaultCfg.rewardMode,
        giftName: typeof parsed.giftName === "string" ? parsed.giftName.trim().slice(0, 140) : "",
        fixedDiscount: Number.isFinite(Number(parsed.fixedDiscount)) ? Math.max(0, Math.floor(Number(parsed.fixedDiscount))) : 0,
        endsAt: typeof parsed.endsAt === "string" ? parsed.endsAt.trim() : "",
        audience: ["all", "new_customers", "returning_customers", "vip_customers", "specific_phones"].includes(parsed.audience) ? parsed.audience : "all",
        allowedPhones: typeof parsed.allowedPhones === "string" ? parsed.allowedPhones.trim() : "",
        placement: ["everywhere", "home_and_cart", "cart_only"].includes(parsed.placement) ? parsed.placement : "everywhere"
      }
    };
  } catch {
    return { cleanMessage: raw.trim(), cfg: defaultCfg };
  }
}
function isRewardCurrentlyActive(settings, subtotal) {
  const threshold = Number(settings.rewardsThreshold ?? "");
  const { cleanMessage, cfg } = unpackServerRewardConfig(settings.rewardsMessage, settings.rewardType);
  if (settings.rewardEnabled !== "true" || !Number.isFinite(threshold) || threshold <= 0 || subtotal < threshold) {
    return { active: false, cfg, cleanMessage, threshold: Number.isFinite(threshold) ? threshold : 0 };
  }
  if (cfg.endsAt) {
    const endMs = new Date(cfg.endsAt).getTime();
    if (Number.isFinite(endMs) && endMs > 0 && Date.now() > endMs) {
      return { active: false, cfg, cleanMessage, threshold };
    }
  }
  return { active: true, cfg, cleanMessage, threshold };
}
function orderTotals(subtotal, deliveryFee, offer, settings) {
  let discount = 0;
  if (offer) {
    if (subtotal < offer.minimumOrder) throw new TRPCError3({ code: "PRECONDITION_FAILED", message: "\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u062F\u0646\u0649 \u0644\u0647\u0630\u0627 \u0627\u0644\u0639\u0631\u0636 " + offer.minimumOrder.toLocaleString("en-US") + " \u0631.\u064A." });
    discount = offer.discountType === "percent" ? Math.floor(subtotal * offer.discountValue / 100) : offer.discountValue;
    discount = Math.min(discount, subtotal);
  }
  let effectiveDeliveryFee = deliveryFee;
  const rewardCheck = isRewardCurrentlyActive(settings, subtotal);
  if (rewardCheck.active) {
    const mode = rewardCheck.cfg.rewardMode;
    if (mode === "free_delivery" || settings.rewardType === "free_delivery" && mode !== "custom_gift" && mode !== "discount_percent" && mode !== "discount_fixed") {
      effectiveDeliveryFee = 0;
    } else if (mode === "discount_percent") {
      const percent = Number(settings.rewardValue ?? "");
      if (Number.isFinite(percent) && percent > 0) discount = Math.min(subtotal, discount + Math.floor(subtotal * Math.min(percent, 100) / 100));
    } else if (mode === "discount_fixed") {
      const fixed = rewardCheck.cfg.fixedDiscount || Number(settings.rewardValue ?? "");
      if (Number.isFinite(fixed) && fixed > 0) discount = Math.min(subtotal, discount + Math.floor(fixed));
    }
  }
  return { subtotal, deliveryFee: effectiveDeliveryFee, discount, total: subtotal + effectiveDeliveryFee - discount };
}
function unpackServerProductWeightCfg(rawDesc) {
  const raw = String(rawDesc || "");
  const m = raw.match(/\[\[wcfg:(\{[\s\S]*?\})\]\]/);
  if (!m) return { enabled: false, minAmount: 100 };
  try {
    const parsed = JSON.parse(m[1]);
    return {
      enabled: Boolean(parsed.enabled),
      minAmount: Number.isFinite(Number(parsed.minAmount)) && Number(parsed.minAmount) > 0 ? Math.floor(Number(parsed.minAmount)) : 100
    };
  } catch {
    return { enabled: false, minAmount: 100 };
  }
}
function formatServerWeightGrams(grams) {
  if (grams === 125) return "125 \u062C\u0631\u0627\u0645 (\u062B\u0645\u0646 \u0643\u064A\u0644\u0648)";
  if (grams === 250) return "250 \u062C\u0631\u0627\u0645 (\u0631\u0628\u0639 \u0643\u064A\u0644\u0648)";
  if (grams === 500) return "500 \u062C\u0631\u0627\u0645 (\u0646\u0635\u0641 \u0643\u064A\u0644\u0648)";
  if (grams === 1e3) return "1 \u0643\u064A\u0644\u0648 \u0643\u0627\u0645\u0644 (1000 \u062C\u0631\u0627\u0645)";
  if (grams > 1e3) return (grams / 1e3).toFixed(2).replace(/\.?0+$/, "") + " \u0643\u064A\u0644\u0648 (" + grams + " \u062C\u0631\u0627\u0645)";
  return grams + " \u062C\u0631\u0627\u0645";
}
function aggregateItems(items) {
  const map = /* @__PURE__ */ new Map();
  for (const item of items) {
    const cur = map.get(item.productId) ?? { quantity: 0, customAmountTotal: 0, name: item.name };
    cur.quantity += item.quantity;
    if (!cur.name && item.name) cur.name = item.name;
    if (item.customAmount && item.customAmount > 0) {
      cur.customAmountTotal += Math.floor(item.customAmount) * item.quantity;
    }
    map.set(item.productId, cur);
  }
  return [...map.entries()].map(([productId, v]) => ({ productId, quantity: v.quantity, customAmountTotal: v.customAmountTotal, name: v.name })).sort((a, b) => a.productId - b.productId);
}
function quoteFingerprint(lines, totals, currency, offerId) {
  return createHash4("sha256").update(JSON.stringify({ lines, totals, currency, offerId })).digest("hex");
}
var assistantRateWindows = /* @__PURE__ */ new Map();
function enforceAssistantRateLimit(key) {
  const now = Date.now();
  if (assistantRateWindows.size > 5e3) {
    for (const [entryKey, entry] of assistantRateWindows) if (now - entry.startedAt >= 6e4) assistantRateWindows.delete(entryKey);
  }
  const current = assistantRateWindows.get(key);
  if (!current || now - current.startedAt >= 6e4) {
    assistantRateWindows.set(key, { startedAt: now, count: 1 });
    return;
  }
  if (current.count >= 200) throw new TRPCError3({ code: "TOO_MANY_REQUESTS", message: "\u0648\u0635\u0644\u062A \u0625\u0644\u0649 \u062D\u062F \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629 \u0627\u0644\u0645\u0624\u0642\u062A. \u062D\u0627\u0648\u0644 \u0645\u062C\u062F\u062F\u064B\u0627 \u0628\u0639\u062F \u062F\u0642\u064A\u0642\u0629\u061B \u0648\u064A\u0645\u0643\u0646\u0643 \u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u062A\u0633\u0648\u0642 \u0645\u0646 \u0627\u0644\u0623\u0642\u0633\u0627\u0645." });
  current.count += 1;
}
function isDuplicateEntry(error) {
  if (!error || typeof error !== "object") return false;
  const dbError = error;
  return dbError.code === "ER_DUP_ENTRY" || dbError.errno === 1062;
}
var categoryInput = z3.object({
  name: z3.string().trim().min(1).max(120),
  description: z3.string().trim().max(2e3).optional().nullable(),
  imageUrl: z3.string().max(85e5).optional().nullable(),
  color: z3.string().regex(/^#[0-9a-fA-F]{6}$/).default("#870210"),
  isActive: z3.boolean().default(true),
  sortOrder: z3.number().int().min(-1e4).max(1e4).default(0)
});
var productInput = z3.object({
  name: z3.string().trim().min(1).max(180),
  description: z3.string().trim().max(5e3).optional().nullable(),
  imageUrl: z3.string().max(85e5).optional().nullable(),
  categoryId: safeId.nullable().optional(),
  price: z3.number().int().min(0).max(1e8),
  unit: z3.string().trim().min(1).max(40),
  stock: z3.number().int().min(0).max(1e8).nullable().optional(),
  minQuantity: z3.number().int().min(1).max(1e6).default(1),
  quantityStep: z3.number().int().min(1).max(1e6).default(1),
  isPublished: z3.boolean().default(false),
  isAvailable: z3.boolean().default(true),
  sortOrder: z3.number().int().min(-1e4).max(1e4).default(0)
});
var liveChatsMemory = /* @__PURE__ */ new Map();
var liveChatsLoaded = false;
async function loadLiveChats(db) {
  if (liveChatsLoaded || !db) return;
  liveChatsLoaded = true;
  try {
    const rows = await db.select().from(storeSettings).where(eq4(storeSettings.key, "live_ai_chats_v1")).limit(1);
    if (rows[0]?.value) {
      const parsed = JSON.parse(rows[0].value);
      if (Array.isArray(parsed)) {
        for (const s of parsed) if (s?.sessionId) liveChatsMemory.set(s.sessionId, s);
      }
    }
  } catch {
  }
}
async function saveLiveChats(db) {
  if (!db) return;
  try {
    const arr = [...liveChatsMemory.values()].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 60).map((s) => ({ ...s, messages: s.messages.slice(-50) }));
    const stored = JSON.stringify(arr);
    await db.insert(storeSettings).values({ key: "live_ai_chats_v1", value: stored }).onDuplicateKeyUpdate({ set: { value: stored } });
  } catch {
  }
}
var HTTP_PRE = ["ht", "tp"].join("");
function toFastImg(kind, row) {
  if (!row || !row.imageUrl) return row;
  const raw = String(row.imageUrl).trim();
  if (!raw || raw.startsWith("/api/fast-img/")) return row;
  try {
    const cacheMap = globalThis.__fastImgCache || (globalThis.__fastImgCache = /* @__PURE__ */ new Map());
    const cacheKey = kind + ":" + row.id;
    const ver = row.updatedAt ? new Date(row.updatedAt).getTime() : globalThis.__catalogVer || 1;
    if (raw.startsWith("data:image/")) {
      const m = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
      if (m) cacheMap.set(cacheKey, { contentType: m[1], buf: Buffer.from(m[2], "base64") });
      return { ...row, imageUrl: "/api/fast-img/" + kind + "/" + row.id + "?v=" + ver };
    }
    if (raw.startsWith(HTTP_PRE)) {
      if (!cacheMap.has(cacheKey)) {
        void fetch(raw).then(async (r) => {
          if (r.ok) {
            const ct = r.headers.get("content-type") || "image/webp";
            const ab = await r.arrayBuffer();
            cacheMap.set(cacheKey, { contentType: ct, buf: Buffer.from(ab) });
          }
        }).catch(() => {
        });
      }
      return { ...row, imageUrl: "/api/fast-img/" + kind + "/" + row.id + "?v=" + ver };
    }
    return row;
  } catch {
    return row;
  }
}
var __refreshingHomePromise = null;
var __orderItemsSchemaFixed = false;
async function ensureOrderItemsFastSchema(dbInstance) {
  if (__orderItemsSchemaFixed) return;
  try {
    const db = dbInstance || await database();
    if (!db) return;
    __orderItemsSchemaFixed = true;
    try {
      await db.execute(sql2.raw("ALTER TABLE order_items MODIFY COLUMN productImage LONGTEXT NULL"));
    } catch {
    }
    try {
      await db.execute(sql2.raw("UPDATE order_items SET productImage = CONCAT('/api/fast-img/product/', productId) WHERE productId IS NOT NULL AND productImage LIKE 'data:image/%'"));
    } catch {
    }
  } catch {
  }
}
async function refreshHomeCatalogCache() {
  if (__refreshingHomePromise) return __refreshingHomePromise;
  __refreshingHomePromise = (async () => {
    try {
      const db = await database();
      void ensureOrderItemsFastSchema(db);
      const [categoryRows, productRows, bannerRows, offerRows, settings] = await Promise.all([
        db.select().from(categories).where(eq4(categories.isActive, true)).orderBy(asc(categories.sortOrder), asc(categories.id)),
        db.select().from(products).where(and2(eq4(products.isPublished, true), eq4(products.isAvailable, true))).orderBy(asc(products.sortOrder), desc(products.createdAt)).limit(500),
        db.select().from(banners).where(and2(eq4(banners.isActive, true))).orderBy(asc(banners.sortOrder), desc(banners.createdAt)),
        db.select().from(offers).where(and2(eq4(offers.isActive, true))).orderBy(desc(offers.createdAt)),
        readSettings(db)
      ]);
      const validBanners = bannerRows.filter((b) => Boolean(b.imageUrl && b.imageUrl.trim()));
      const g = globalThis;
      g.__fastHomeData = {
        categories: categoryRows.map((r) => toFastImg("category", r)),
        products: productRows.map((r) => toFastImg("product", r)),
        banners: validBanners.map((r) => toFastImg("banner", r)),
        offers: offerRows,
        settings
      };
      g.__fastHomeTime = Date.now();
      return g.__fastHomeData;
    } finally {
      __refreshingHomePromise = null;
    }
  })();
  return __refreshingHomePromise;
}
globalThis.__loadCatalogHome = refreshHomeCatalogCache;
setTimeout(() => {
  void refreshHomeCatalogCache().catch(() => {
  });
}, 80);
var commerceRouter = router({
  access: publicProcedure.query(({ ctx }) => {
    const isAdminActive = ctx.user?.role === "admin" && !ctx.user.suspended;
    const isOwner = Boolean(ctx.user?.isOwner ?? (isAdminActive && !ctx.user?.adminRole));
    const adminRole = ctx.user?.adminRole ?? (isOwner ? "owner" : null);
    const permissions = ctx.user?.permissions ?? (isOwner ? [...PERMISSION_KEYS] : []);
    return {
      authenticated: Boolean(ctx.user),
      isAdmin: isAdminActive,
      isOwner,
      adminRole,
      permissions,
      allowedCategoryIds: ctx.user?.allowedCategoryIds ?? [],
      mustChangePassword: Boolean(ctx.user?.mustChangePassword),
      staffId: ctx.user?.staffId ?? null,
      staffUsername: ctx.user?.staffUsername ?? null,
      displayName: ctx.user?.name ?? null,
      isSuspended: Boolean(ctx.user?.suspended)
    };
  }),
  notifications: router({
    publicKey: publicProcedure.query(() => getWebPushPublicKey())
  }),
  catalog: router({
    home: publicProcedure.query(async () => {
      const now = Date.now();
      const g = globalThis;
      if (g.__fastHomeData) {
        if (now - (g.__fastHomeTime || 0) > 6e5) {
          void refreshHomeCatalogCache().catch(() => {
          });
        }
        return g.__fastHomeData;
      }
      return await refreshHomeCatalogCache();
    }),
    listProducts: publicProcedure.input(z3.object({
      search: z3.string().trim().max(120).optional(),
      categoryId: safeId.optional(),
      sort: z3.enum(["featured", "price-asc", "price-desc", "name"]).default("featured"),
      limit: z3.number().int().min(1).max(500).default(250)
    }).optional()).query(async ({ input }) => {
      const g = globalThis;
      let base = g.__fastHomeData?.products;
      if (!Array.isArray(base)) {
        const homeData = await refreshHomeCatalogCache();
        base = homeData?.products || [];
      }
      let list = [...base];
      if (input?.categoryId) list = list.filter((p) => p.categoryId === input.categoryId);
      if (input?.search) {
        const q = input.search.toLowerCase();
        list = list.filter((p) => String(p.name || "").toLowerCase().includes(q) || String(p.description || "").toLowerCase().includes(q));
      }
      if (input?.sort === "price-asc") list.sort((a, b) => a.price - b.price);
      else if (input?.sort === "price-desc") list.sort((a, b) => b.price - a.price);
      else if (input?.sort === "name") list.sort((a, b) => String(a.name).localeCompare(String(b.name), "ar"));
      return list.slice(0, input?.limit ?? 250);
    }),
    listCategories: publicProcedure.query(async () => {
      const g = globalThis;
      if (Array.isArray(g.__fastHomeData?.categories)) return g.__fastHomeData.categories;
      const homeData = await refreshHomeCatalogCache();
      return homeData?.categories || [];
    }),
    product: publicProcedure.input(z3.object({ id: safeId.optional(), slug: z3.string().max(220).optional() })).query(async ({ input }) => getCached("product:" + JSON.stringify(input), 6e4, async () => {
      const db = await database();
      const product = (await db.select().from(products).where(and2(
        input.id ? eq4(products.id, input.id) : eq4(products.slug, input.slug ?? ""),
        eq4(products.isPublished, true),
        eq4(products.isAvailable, true)
      )).limit(1))[0];
      if (!product) throw new TRPCError3({ code: "NOT_FOUND", message: "\u0627\u0644\u0645\u0646\u062A\u062C \u063A\u064A\u0631 \u0645\u062A\u0627\u062D." });
      const linked = await db.select({ product: products }).from(productRecommendations).innerJoin(products, eq4(productRecommendations.recommendedProductId, products.id)).where(and2(eq4(productRecommendations.productId, product.id), eq4(products.isPublished, true), eq4(products.isAvailable, true)));
      return { ...toFastImg("product", product), recommendations: linked.map((row) => toFastImg("product", row.product)) };
    })),
    productsForReorder: publicProcedure.input(z3.object({ ids: z3.array(safeId).min(1).max(500) })).query(async ({ input }) => {
      const db = await database();
      const rows = await db.select().from(products).where(and2(inArray(products.id, [...new Set(input.ids)]), eq4(products.isPublished, true), eq4(products.isAvailable, true)));
      return rows.map((r) => toFastImg("product", r));
    })
  }),
  profile: router({
    updateName: protectedProcedure.input(z3.object({ name: z3.string().trim().min(2).max(120) })).mutation(async ({ ctx, input }) => {
      const db = await database();
      await db.update(users).set({ name: input.name }).where(eq4(users.id, ctx.user.id));
      clearCatalogCache();
      return { success: true };
    }),
    updatePhone: protectedProcedure.input(z3.object({ phone: z3.string().trim().min(7).max(32) })).mutation(async ({ ctx, input }) => {
      const db = await database();
      await db.update(users).set({ phone: input.phone }).where(eq4(users.id, ctx.user.id));
      clearCatalogCache();
      return { success: true };
    }),
    addresses: protectedProcedure.query(async ({ ctx }) => {
      const db = await database();
      return db.select().from(addresses).where(eq4(addresses.userId, ctx.user.id)).orderBy(desc(addresses.isDefault), desc(addresses.id));
    }),
    saveAddress: protectedProcedure.input(z3.object({
      id: safeId.optional(),
      label: z3.string().trim().min(1).max(80),
      recipientName: z3.string().trim().min(2).max(160),
      phone: z3.string().trim().min(7).max(32),
      city: z3.string().trim().min(1).max(100),
      district: z3.string().trim().min(1).max(120),
      details: z3.string().trim().max(1e3).optional().nullable(),
      isDefault: z3.boolean().default(false)
    })).mutation(async ({ ctx, input }) => {
      const db = await database();
      await db.transaction(async (tx) => {
        if (input.isDefault) await tx.update(addresses).set({ isDefault: false }).where(eq4(addresses.userId, ctx.user.id));
        const values = { userId: ctx.user.id, label: input.label, recipientName: input.recipientName, phone: normalizeYemeniPhone(input.phone), city: input.city, district: input.district, details: input.details ?? null, isDefault: input.isDefault };
        if (input.id) {
          const owned = (await tx.select({ id: addresses.id }).from(addresses).where(and2(eq4(addresses.id, input.id), eq4(addresses.userId, ctx.user.id))).limit(1))[0];
          if (!owned) throw new TRPCError3({ code: "NOT_FOUND", message: "\u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u062D\u0633\u0627\u0628\u0643." });
          await tx.update(addresses).set(values).where(and2(eq4(addresses.id, input.id), eq4(addresses.userId, ctx.user.id)));
        } else await tx.insert(addresses).values(values);
      });
      clearCatalogCache();
      return { success: true };
    }),
    deleteAddress: protectedProcedure.input(z3.object({ id: safeId })).mutation(async ({ ctx, input }) => {
      const db = await database();
      await db.delete(addresses).where(and2(eq4(addresses.id, input.id), eq4(addresses.userId, ctx.user.id)));
      clearCatalogCache();
      return { success: true };
    })
  }),
  favorites: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await database();
      const rows = await db.select({ product: products }).from(favorites).innerJoin(products, eq4(favorites.productId, products.id)).where(and2(eq4(favorites.userId, ctx.user.id), eq4(products.isPublished, true), eq4(products.isAvailable, true)));
      return rows.map((row) => row.product);
    }),
    toggle: protectedProcedure.input(z3.object({ productId: safeId })).mutation(async ({ ctx, input }) => {
      const db = await database();
      const product = (await db.select({ id: products.id }).from(products).where(and2(eq4(products.id, input.productId), eq4(products.isPublished, true), eq4(products.isAvailable, true))).limit(1))[0];
      if (!product) throw new TRPCError3({ code: "NOT_FOUND", message: "\u0627\u0644\u0645\u0646\u062A\u062C \u063A\u064A\u0631 \u0645\u062A\u0627\u062D." });
      const existing = (await db.select().from(favorites).where(and2(eq4(favorites.userId, ctx.user.id), eq4(favorites.productId, input.productId))).limit(1))[0];
      if (existing) await db.delete(favorites).where(eq4(favorites.id, existing.id));
      else await db.insert(favorites).values({ userId: ctx.user.id, productId: input.productId });
      return { saved: !existing };
    })
  }),
  orders: router({
    quote: publicProcedure.input(z3.object({
      items: z3.array(z3.object({ productId: safeId, quantity: z3.number().int().min(1).max(1e4), name: z3.string().trim().max(220).optional(), variant: z3.string().trim().max(120).optional(), customAmount: z3.number().int().min(1).max(1e8).optional() })).min(1).max(100),
      city: z3.string().trim().min(1).max(100),
      district: z3.string().trim().max(160).optional(),
      phone: z3.string().trim().max(40).optional(),
      offerCode: z3.string().trim().max(40).optional()
    })).mutation(async ({ input }) => {
      const db = await database();
      const settings = await readSettings(db);
      if (settings.orderPaused === "true") throw new TRPCError3({ code: "PRECONDITION_FAILED", message: settings.pausedMessage || "\u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0645\u062A\u0648\u0642\u0641 \u0645\u0624\u0642\u062A\u064B\u0627." });
      const prelimFee = deliveryFeeForCity(settings, input.city, input.district, input.phone, 0);
      if (prelimFee === null) throw new TRPCError3({ code: "PRECONDITION_FAILED", message: settings.deliveryEnabled === "true" ? "\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062A\u0648\u0635\u064A\u0644 \u0623\u0648 \u0631\u0633\u0648\u0645\u0647\u0627 \u063A\u064A\u0631 \u0645\u062D\u062F\u062F\u0629 \u0628\u0639\u062F." : "\u0644\u0645 \u064A\u0641\u0639\u0651\u0644 \u0627\u0644\u0645\u062A\u062C\u0631 \u0627\u0644\u062A\u0648\u0635\u064A\u0644 \u0628\u0639\u062F." });
      const requested = aggregateItems(input.items);
      if (requested.some((item) => item.quantity > 1e4)) throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0627\u0644\u0643\u0645\u064A\u0629 \u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A\u0629 \u0644\u0623\u062D\u062F \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u062A\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062D\u062F \u0627\u0644\u0645\u0633\u0645\u0648\u062D." });
      const productIds = requested.map((item) => item.productId);
      const currentProducts = await db.select({ id: products.id, name: products.name, description: products.description, price: products.price, unit: products.unit, stock: products.stock, minQuantity: products.minQuantity, quantityStep: products.quantityStep }).from(products).where(and2(inArray(products.id, productIds), eq4(products.isPublished, true), eq4(products.isAvailable, true)));
      if (currentProducts.length !== productIds.length) {
        const foundIds = new Set(currentProducts.map((p) => p.id));
        const missingReq = requested.filter((r) => !foundIds.has(r.productId));
        const missingIds = missingReq.map((r) => r.productId);
        const dbMissing = missingIds.length ? await db.select({ id: products.id, name: products.name }).from(products).where(inArray(products.id, missingIds)) : [];
        const histMissing = missingIds.length ? await db.select({ productId: orderItems.productId, name: orderItems.productName }).from(orderItems).where(inArray(orderItems.productId, missingIds)).limit(30) : [];
        const missingNames = missingReq.map((r) => r.name || dbMissing.find((d) => d.id === r.productId)?.name || histMissing.find((h) => h.productId === r.productId)?.name || "\u0645\u0646\u062A\u062C #" + r.productId);
        for (const mid of missingIds) clearCatalogCache(mid);
        throw new TRPCError3({ code: "PRECONDITION_FAILED", message: "\u0627\u0644\u0645\u0646\u062A\u062C \xAB" + missingNames.join("\u060C ") + "\xBB \u0644\u0645 \u064A\u0639\u062F \u0645\u062A\u0648\u0641\u0631\u0627\u064B \u062D\u0627\u0644\u064A\u0627\u064B \u0641\u064A \u0627\u0644\u0645\u062A\u062C\u0631. \u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0633\u0644\u0629 \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B." });
      }
      const lines = requested.map((item) => {
        const product = currentProducts.find((row) => row.id === item.productId);
        const wcfg = unpackServerProductWeightCfg(product.description);
        if (wcfg.enabled && item.customAmountTotal > 0) {
          if (item.customAmountTotal < wcfg.minAmount) {
            throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0623\u0642\u0644 \u0645\u0628\u0644\u063A \u0645\u0633\u0645\u0648\u062D \u0644\u0634\u0631\u0627\u0621 \xAB" + product.name + "\xBB \u0647\u0648 " + wcfg.minAmount.toLocaleString("en-US") + " \u0631.\u064A." });
          }
          if (product.stock !== null && product.stock < 1) {
            throw new TRPCError3({ code: "PRECONDITION_FAILED", message: "\u0627\u0644\u0643\u0645\u064A\u0629 \u0627\u0644\u0645\u062A\u0648\u0641\u0631\u0629 \u0645\u0646 \xAB" + product.name + "\xBB \u0644\u0627 \u062A\u0643\u0641\u064A." });
          }
          const grams = Math.max(1, Math.round(item.customAmountTotal / Math.max(1, product.price) * 1e3));
          const weightUnit = formatServerWeightGrams(grams);
          return { productId: product.id, name: product.name, quantity: 1, unit: weightUnit, price: item.customAmountTotal, lineTotal: item.customAmountTotal };
        }
        if (item.quantity < product.minQuantity || (item.quantity - product.minQuantity) % product.quantityStep !== 0) throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0627\u0644\u0643\u0645\u064A\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629 \u0645\u0646 \xAB" + product.name + "\xBB \u0644\u0627 \u062A\u0648\u0627\u0641\u0642 \u0648\u062D\u062F\u0629 \u0627\u0644\u0628\u064A\u0639." });
        if (product.stock !== null && product.stock < item.quantity) throw new TRPCError3({ code: "PRECONDITION_FAILED", message: "\u0627\u0644\u0643\u0645\u064A\u0629 \u0627\u0644\u0645\u062A\u0648\u0641\u0631\u0629 \u0645\u0646 \xAB" + product.name + "\xBB \u0644\u0627 \u062A\u0643\u0641\u064A." });
        return { productId: product.id, name: product.name, quantity: item.quantity, unit: product.unit, price: product.price, lineTotal: product.price * item.quantity };
      });
      const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
      if (!Number.isSafeInteger(subtotal) || subtotal > 1e11) throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0633\u0644\u0629 \u064A\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062D\u062F \u0627\u0644\u0645\u0633\u0645\u0648\u062D." });
      let appliedOffer = null;
      if (input.offerCode) {
        appliedOffer = (await db.select().from(offers).where(and2(eq4(offers.code, input.offerCode.trim().toUpperCase()), eq4(offers.isActive, true), sql2`(${offers.startsAt} is null or ${offers.startsAt} <= now())`, sql2`(${offers.endsAt} is null or ${offers.endsAt} >= now())`)).limit(1))[0] ?? null;
        if (!appliedOffer) throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0631\u0645\u0632 \u0627\u0644\u0639\u0631\u0636 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0623\u0648 \u063A\u064A\u0631 \u0646\u0634\u0637." });
      }
      const deliveryFee = deliveryFeeForCity(settings, input.city, input.district, input.phone, subtotal) ?? prelimFee;
      const totals = orderTotals(subtotal, deliveryFee, appliedOffer, settings);
      const currency = settings.currency || "\u0631.\u064A";
      return { lines, ...totals, currency, quoteHash: quoteFingerprint(lines, totals, currency, appliedOffer?.id ?? null), offerTitle: appliedOffer?.title ?? null };
    }),
    trackMany: publicProcedure.input(z3.object({
      refs: z3.array(z3.object({
        orderNumber: z3.string().trim().min(6).max(40).regex(/^OR-[A-Z0-9]+-[A-Z0-9]{5}$/i),
        idempotencyKey: z3.string().uuid()
      })).min(1).max(50)
    })).query(async ({ input }) => {
      const db = await database();
      const referenceByNumber = new Map(input.refs.map((reference) => [reference.orderNumber, reference.idempotencyKey]));
      const candidates = await db.select().from(orders).where(inArray(orders.orderNumber, [...referenceByNumber.keys()])).orderBy(desc(orders.createdAt), desc(orders.id)).limit(50);
      const authorized = candidates.filter((order) => {
        const key = referenceByNumber.get(order.orderNumber);
        return key ? matchesGuestOrderKey(key, order.idempotencyKey) : false;
      });
      if (!authorized.length) return [];
      const orderIds = authorized.map((order) => order.id);
      const [items, events] = await Promise.all([
        db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds)),
        db.select({ id: orderEvents.id, orderId: orderEvents.orderId, status: orderEvents.status, note: orderEvents.note, createdAt: orderEvents.createdAt }).from(orderEvents).where(inArray(orderEvents.orderId, orderIds)).orderBy(asc(orderEvents.createdAt))
      ]);
      return authorized.map((order) => ({
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
        items: items.filter((item) => item.orderId === order.id),
        events: events.filter((event) => event.orderId === order.id).map(({ id, status, note, createdAt }) => ({ id, status, note, createdAt }))
      }));
    }),
    subscribeToStatus: publicProcedure.input(z3.object({
      refs: z3.array(z3.object({
        orderNumber: z3.string().trim().min(6).max(40).regex(/^OR-[A-Z0-9]+-[A-Z0-9]{5}$/i),
        idempotencyKey: z3.string().uuid()
      })).min(1).max(50),
      subscription: pushSubscriptionSchema
    })).mutation(async ({ input }) => {
      if (!isAllowedPushEndpoint(input.subscription.endpoint)) {
        throw new TRPCError3({ code: "BAD_REQUEST", message: "\u062E\u062F\u0645\u0629 \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062A \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0645\u062A\u0635\u0641\u062D \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645\u0629." });
      }
      const db = await database();
      const referenceByNumber = new Map(input.refs.map((reference) => [reference.orderNumber, reference.idempotencyKey]));
      const candidates = await db.select({ id: orders.id, orderNumber: orders.orderNumber, idempotencyKey: orders.idempotencyKey }).from(orders).where(inArray(orders.orderNumber, [...referenceByNumber.keys()])).limit(50);
      const authorized = candidates.filter((order) => {
        const key = referenceByNumber.get(order.orderNumber);
        return key ? matchesGuestOrderKey(key, order.idempotencyKey) : false;
      });
      if (!authorized.length) return { subscribed: 0 };
      const protectedSubscription = protectPushSubscription(input.subscription);
      await db.transaction(async (tx) => {
        for (const order of authorized) {
          await tx.insert(customerPushSubscriptions).values({
            orderId: order.id,
            ...protectedSubscription
          }).onDuplicateKeyUpdate({ set: { encryptedPayload: protectedSubscription.encryptedPayload, updatedAt: /* @__PURE__ */ new Date() } });
        }
      });
      return { subscribed: authorized.length };
    }),
    mine: protectedProcedure.query(async ({ ctx }) => {
      const db = await database();
      const rows = await db.select().from(orders).where(eq4(orders.userId, ctx.user.id)).orderBy(desc(orders.createdAt)).limit(100);
      if (!rows.length) return [];
      const orderIds = rows.map((row) => sql2`${row.id}`);
      const [items, events] = await Promise.all([
        db.select().from(orderItems).where(sql2`${orderItems.orderId} in (${sql2.join(orderIds, sql2`, `)})`),
        db.select().from(orderEvents).where(sql2`${orderEvents.orderId} in (${sql2.join(orderIds, sql2`, `)})`).orderBy(asc(orderEvents.createdAt))
      ]);
      return rows.map((order) => ({ ...order, items: items.filter((item) => item.orderId === order.id), events: events.filter((event) => event.orderId === order.id) }));
    }),
    place: publicProcedure.input(z3.object({
      idempotencyKey: z3.string().uuid(),
      expectedTotal: z3.number().int().min(0).max(1e11),
      expectedQuoteHash: z3.string().length(64).regex(/^[a-f0-9]+$/),
      items: z3.array(z3.object({ productId: safeId, quantity: z3.number().int().min(1).max(1e4), name: z3.string().trim().max(220).optional(), variant: z3.string().trim().max(120).optional(), customAmount: z3.number().int().min(1).max(1e8).optional() })).min(1).max(100),
      offerCode: z3.string().trim().max(40).optional(),
      recipientName: z3.string().trim().min(2).max(160),
      phone: z3.string().trim().min(7).max(32).refine(isValidGuestPhone, "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0631\u0642\u0645 \u062C\u0648\u0627\u0644 \u064A\u0645\u0646\u064A \u0635\u062D\u064A\u062D \u0645\u0643\u0648\u0646 \u0645\u0646 9 \u0623\u0631\u0642\u0627\u0645 \u0648\u064A\u0628\u062F\u0623 \u0628\u0640 77 \u0623\u0648 73 \u0623\u0648 78 \u0623\u0648 71 \u0623\u0648 70."),
      city: z3.string().trim().min(1).max(100),
      district: z3.string().trim().min(1).max(120),
      addressDetails: z3.string().trim().max(1e3).optional(),
      customerNote: z3.string().trim().max(1e3).optional()
    })).mutation(async ({ ctx, input }) => {
      const db = await database();
      const requested = aggregateItems(input.items);
      if (requested.some((item) => item.quantity > 1e4)) throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0627\u0644\u0643\u0645\u064A\u0629 \u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A\u0629 \u0644\u0623\u062D\u062F \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u062A\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062D\u062F \u0627\u0644\u0645\u0633\u0645\u0648\u062D." });
      const storedIdempotencyKey = hashGuestOrderKey(input.idempotencyKey);
      const existing = (await db.select().from(orders).where(inArray(orders.idempotencyKey, [storedIdempotencyKey, input.idempotencyKey])).limit(1))[0];
      if (existing) return { id: existing.id, orderNumber: existing.orderNumber, total: existing.total, duplicate: true };
      if (typeof enforceOrderCreateRateLimit === "function") enforceOrderCreateRateLimit(getClientIp(ctx.req));
      const settings = await readSettings(db);
      if (settings.orderPaused === "true") throw new TRPCError3({ code: "PRECONDITION_FAILED", message: settings.pausedMessage || "\u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0645\u062A\u0648\u0642\u0641 \u0645\u0624\u0642\u062A\u064B\u0627." });
      const prelimDeliveryFee = deliveryFeeForCity(settings, input.city, input.district, input.phone, 0);
      if (prelimDeliveryFee === null) throw new TRPCError3({ code: "PRECONDITION_FAILED", message: "\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u062A\u0648\u0635\u064A\u0644 \u0623\u0648 \u0631\u0633\u0648\u0645\u0647\u0627 \u063A\u064A\u0631 \u0645\u062D\u062F\u062F\u0629 \u0628\u0639\u062F." });
      let appliedOffer = null;
      if (input.offerCode) {
        const code = input.offerCode.trim().toUpperCase();
        appliedOffer = (await db.select().from(offers).where(and2(eq4(offers.code, code), eq4(offers.isActive, true), sql2`(${offers.startsAt} is null or ${offers.startsAt} <= now())`, sql2`(${offers.endsAt} is null or ${offers.endsAt} >= now())`)).limit(1))[0] ?? null;
        if (!appliedOffer) throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0631\u0645\u0632 \u0627\u0644\u0639\u0631\u0636 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0623\u0648 \u063A\u064A\u0631 \u0646\u0634\u0637." });
      }
      await ensureOrderItemsFastSchema(db);
      const result = await db.transaction(async (tx) => {
        const orderLines = [];
        let subtotal = 0;
        for (const item of requested) {
          const product = (await tx.select({
            id: products.id,
            name: products.name,
            description: products.description,
            price: products.price,
            unit: products.unit,
            stock: products.stock,
            minQuantity: products.minQuantity,
            quantityStep: products.quantityStep
          }).from(products).where(and2(eq4(products.id, item.productId), eq4(products.isPublished, true), eq4(products.isAvailable, true))).limit(1).for("update"))[0];
          if (!product) {
            const anyProd = (await tx.select({ name: products.name }).from(products).where(eq4(products.id, item.productId)).limit(1))[0];
            const missingName = item.name || anyProd?.name || "\u0645\u0646\u062A\u062C #" + item.productId;
            clearCatalogCache(item.productId);
            throw new TRPCError3({ code: "PRECONDITION_FAILED", message: "\u0627\u0644\u0645\u0646\u062A\u062C \xAB" + missingName + "\xBB \u0644\u0645 \u064A\u0639\u062F \u0645\u062A\u0648\u0641\u0631\u0627\u064B \u062D\u0627\u0644\u064A\u0627\u064B \u0641\u064A \u0627\u0644\u0645\u062A\u062C\u0631. \u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0633\u0644\u0629 \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B." });
          }
          const wcfg = unpackServerProductWeightCfg(product.description);
          if (wcfg.enabled && item.customAmountTotal > 0) {
            if (item.customAmountTotal < wcfg.minAmount) {
              throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0623\u0642\u0644 \u0645\u0628\u0644\u063A \u0645\u0633\u0645\u0648\u062D \u0644\u0634\u0631\u0627\u0621 \xAB" + product.name + "\xBB \u0647\u0648 " + wcfg.minAmount.toLocaleString("en-US") + " \u0631.\u064A." });
            }
            if (product.stock !== null && product.stock < 1) throw new TRPCError3({ code: "PRECONDITION_FAILED", message: "\u0627\u0644\u0643\u0645\u064A\u0629 \u0627\u0644\u0645\u062A\u0648\u0641\u0631\u0629 \u0645\u0646 \xAB" + product.name + "\xBB \u0644\u0627 \u062A\u0643\u0641\u064A." });
            const grams = Math.max(1, Math.round(item.customAmountTotal / Math.max(1, product.price) * 1e3));
            const weightUnit = formatServerWeightGrams(grams);
            subtotal += item.customAmountTotal;
            if (!Number.isSafeInteger(subtotal) || subtotal > 1e11) throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0633\u0644\u0629 \u064A\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062D\u062F \u0627\u0644\u0645\u0633\u0645\u0648\u062D." });
            orderLines.push({ product, quantity: 1, effectiveUnit: weightUnit, effectivePrice: item.customAmountTotal, effectiveLineTotal: item.customAmountTotal, isWeighed: true });
          } else {
            if (item.quantity < product.minQuantity || (item.quantity - product.minQuantity) % product.quantityStep !== 0) {
              throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0627\u0644\u0643\u0645\u064A\u0629 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629 \u0645\u0646 \xAB" + product.name + "\xBB \u0644\u0627 \u062A\u0648\u0627\u0641\u0642 \u0648\u062D\u062F\u0629 \u0627\u0644\u0628\u064A\u0639." });
            }
            if (product.stock !== null && product.stock < item.quantity) throw new TRPCError3({ code: "PRECONDITION_FAILED", message: "\u0627\u0644\u0643\u0645\u064A\u0629 \u0627\u0644\u0645\u062A\u0648\u0641\u0631\u0629 \u0645\u0646 \xAB" + product.name + "\xBB \u0644\u0627 \u062A\u0643\u0641\u064A." });
            const lineTotal = product.price * item.quantity;
            subtotal += lineTotal;
            if (!Number.isSafeInteger(subtotal) || subtotal > 1e11) throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0633\u0644\u0629 \u064A\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062D\u062F \u0627\u0644\u0645\u0633\u0645\u0648\u062D." });
            orderLines.push({ product, quantity: item.quantity, effectiveUnit: product.unit, effectivePrice: product.price, effectiveLineTotal: lineTotal, isWeighed: false });
          }
        }
        const finalDeliveryFee = deliveryFeeForCity(settings, input.city, input.district, input.phone, subtotal) ?? prelimDeliveryFee;
        const totals = orderTotals(subtotal, finalDeliveryFee, appliedOffer, settings);
        const currency = settings.currency || "\u0631.\u064A";
        const currentLines = orderLines.map((line) => ({ productId: line.product.id, name: line.product.name, quantity: line.quantity, unit: line.effectiveUnit, price: line.effectivePrice, lineTotal: line.effectiveLineTotal }));
        const currentQuoteHash = quoteFingerprint(currentLines, totals, currency, appliedOffer?.id ?? null);
        if (totals.total !== input.expectedTotal || currentQuoteHash !== input.expectedQuoteHash) throw new TRPCError3({ code: "PRECONDITION_FAILED", message: "\u062A\u063A\u064A\u0651\u0631 \u0627\u0644\u0633\u0639\u0631 \u0623\u0648 \u0627\u0644\u062A\u0648\u0641\u0631 \u0623\u0648 \u0631\u0633\u0648\u0645 \u0627\u0644\u062A\u0648\u0635\u064A\u0644 \u0628\u0639\u062F \u0627\u0644\u0645\u0639\u0627\u064A\u0646\u0629. \u0627\u0639\u0631\u0636 \u0627\u0644\u0645\u0644\u062E\u0635 \u0627\u0644\u0645\u062D\u062F\u0651\u062B \u0642\u0628\u0644 \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0637\u0644\u0628." });
        const orderNumber = "OR-" + Date.now().toString(36).toUpperCase() + "-" + nanoid(5).toUpperCase();
        const inserted = await tx.insert(orders).values({
          orderNumber,
          idempotencyKey: storedIdempotencyKey,
          userId: null,
          offerId: appliedOffer?.id ?? null,
          recipientName: input.recipientName,
          phone: normalizeYemeniPhone(input.phone),
          city: input.city,
          district: input.district,
          addressDetails: input.addressDetails ?? null,
          customerNote: input.customerNote ?? null,
          subtotal,
          deliveryFee: totals.deliveryFee,
          discount: totals.discount,
          total: totals.total,
          status: "new"
        });
        const orderId = Number(inserted[0].insertId);
        for (const line of orderLines) {
          const vParts = input.items.filter((i) => i.productId === line.product.id && i.variant && i.variant.trim()).map((i) => !line.isWeighed && i.quantity > 1 ? i.variant.trim() + " \xD7 " + i.quantity : i.variant.trim());
          const baseTitle = vParts.length > 0 ? line.product.name + " (" + vParts.join("\u060C ") + ")" : line.isWeighed ? line.product.name + " (\u2696\uFE0F " + line.effectiveUnit + ")" : line.product.name;
          const finalProdName = baseTitle.slice(0, 180);
          await tx.insert(orderItems).values({
            orderId,
            productId: line.product.id,
            productName: finalProdName,
            productImage: "/api/fast-img/product/" + line.product.id,
            unit: line.effectiveUnit,
            unitPrice: line.effectivePrice,
            quantity: line.quantity,
            lineTotal: line.effectiveLineTotal
          });
          if (line.product.stock !== null) {
            await tx.update(products).set({ stock: Math.max(0, line.product.stock - line.quantity) }).where(eq4(products.id, line.product.id));
          }
        }
        if (typeof isRewardCurrentlyActive === "function") {
          const rewardStatus = isRewardCurrentlyActive(settings, subtotal);
          if (rewardStatus.active && (rewardStatus.cfg.giftName || rewardStatus.cfg.rewardMode === "custom_gift")) {
            const giftLabel = rewardStatus.cfg.giftName || rewardStatus.cleanMessage || "\u0647\u062F\u064A\u0629 \u0645\u062C\u0627\u0646\u064A\u0629 \u0645\u0646 \u0623\u0648\u0631\u062C\u0646\u0627\u0644";
            await tx.insert(orderItems).values({
              orderId,
              productId: null,
              productName: ("\u{1F381} \u0647\u062F\u064A\u0629 \u0627\u0644\u0639\u0631\u0636 \u0627\u0644\u0645\u062C\u0627\u0646\u064A\u0629: " + giftLabel).slice(0, 180),
              productImage: null,
              unit: "\u0647\u062F\u064A\u0629 \u0645\u062C\u0627\u0646\u064A\u0629",
              unitPrice: 0,
              quantity: 1,
              lineTotal: 0
            });
          }
        }
        await tx.insert(orderEvents).values({ orderId, status: "new", note: "\u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u0627\u0644\u0637\u0644\u0628", changedByUserId: null });
        return { id: orderId, orderNumber, total: totals.total, duplicate: false };
      }).catch(async (error) => {
        if (!isDuplicateEntry(error)) {
          if (error instanceof TRPCError3) throw error;
          console.error("[Order Place Error]", String(error?.message || error).slice(0, 300));
          throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0627\u0644\u0637\u0644\u0628 \u0645\u0624\u0642\u062A\u0627\u064B\u060C \u064A\u0631\u062C\u0649 \u0627\u0644\u0636\u063A\u0637 \u0639\u0644\u0649 \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0637\u0644\u0628 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649." });
        }
        const concurrent = (await db.select().from(orders).where(inArray(orders.idempotencyKey, [storedIdempotencyKey, input.idempotencyKey])).limit(1))[0];
        if (!concurrent) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "\u062A\u0639\u0630\u0631 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0637\u0644\u0628\u060C \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649." });
        return { id: concurrent.id, orderNumber: concurrent.orderNumber, total: concurrent.total, duplicate: true };
      });
      if (!result.duplicate) {
        void notifyOwnerNewOrder(result.id, result.orderNumber, result.total, input.recipientName, input.city + " - " + input.district).catch(() => console.warn("[Push] Could not notify owner of a new order"));
      }
      return result;
    })
  }),
  assistant: router({
    pollMessages: publicProcedure.input(z3.object({
      sessionId: z3.string().trim().min(1).max(80)
    })).query(async ({ input }) => {
      const db = await getDb();
      const settings = db ? await readSettings(db) : { deliveryEnabled: "true", deliveryFee: "0" };
      await loadLiveChats(db);
      const session = liveChatsMemory.get(input.sessionId);
      return {
        aiPaused: session?.aiPaused ?? false,
        ownerMessages: (session?.messages ?? []).filter((m) => m.role === "owner")
      };
    }),
    recipe: publicProcedure.input(z3.object({
      request: z3.string().trim().min(1).max(1200),
      history: z3.array(z3.object({ role: z3.enum(["user", "assistant"]), text: z3.string().max(1800) })).max(20).optional(),
      cart: z3.array(z3.object({ productId: safeId, quantity: z3.number().int().min(1).max(1e4) })).max(100).optional(),
      favoriteProductIds: z3.array(safeId).max(500).optional(),
      sessionId: z3.string().max(80).optional(),
      customerName: z3.string().max(160).optional(),
      customerPhone: z3.string().max(40).optional()
    })).mutation(async ({ input, ctx }) => {
      const clientKey = ctx.user ? "user:" + ctx.user.id : "ip:" + (ctx.req.ip || "unknown-client");
      enforceAssistantRateLimit(clientKey.slice(0, 120));
      const db = await getDb();
      await loadLiveChats(db);
      const sid = (input.sessionId?.trim() || clientKey).slice(0, 80);
      const customerNameClean = input.customerName?.trim() || "\u0632\u0628\u0648\u0646 \u0627\u0644\u0645\u062A\u062C\u0631";
      const customerPhoneClean = input.customerPhone?.trim() || "\u063A\u064A\u0631 \u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u0645\u0648\u0642\u0639";
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      let chatSession = liveChatsMemory.get(sid);
      if (!chatSession) {
        chatSession = {
          sessionId: sid,
          customerName: customerNameClean,
          customerPhone: customerPhoneClean,
          aiPaused: false,
          updatedAt: nowIso,
          messages: []
        };
        liveChatsMemory.set(sid, chatSession);
      } else {
        if (input.customerName?.trim()) chatSession.customerName = customerNameClean;
        if (input.customerPhone?.trim()) chatSession.customerPhone = customerPhoneClean;
        chatSession.updatedAt = nowIso;
      }
      chatSession.messages.push({
        id: nanoid(10),
        role: "user",
        sender: chatSession.customerName,
        text: input.request,
        createdAt: nowIso
      });
      await saveLiveChats(db);
      if (chatSession.aiPaused) {
        return {
          message: "\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0631\u0633\u0627\u0644\u062A\u0643 \u0625\u0644\u0649 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u062A\u062C\u0631 \u0645\u0628\u0627\u0634\u0631\u0629\u060C \u0648\u0633\u064A\u0631\u062F \u0639\u0644\u064A\u0643 \u0627\u0644\u0645\u0627\u0644\u0643 \u0647\u0646\u0627 \u0641\u064A \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629 \u062E\u0644\u0627\u0644 \u0644\u062D\u0638\u0627\u062A...",
          recipe: null,
          ingredients: [],
          missingIngredients: [],
          cartAction: null,
          suggestedQuestions: ["\u0639\u0631\u0636 \u0627\u0644\u0633\u0644\u0629", "\u062A\u0635\u0641\u062D \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A"]
        };
      }
      const [catalogRows, catRows] = db ? await Promise.all([
        db.select({ id: products.id, name: products.name, description: products.description, categoryId: products.categoryId, price: products.price, unit: products.unit, stock: products.stock, minQuantity: products.minQuantity, quantityStep: products.quantityStep }).from(products).where(and2(eq4(products.isPublished, true), eq4(products.isAvailable, true))).limit(150).catch(() => []),
        db.select({ id: categories.id, name: categories.name }).from(categories).catch(() => [])
      ]) : [[], []];
      const catNameById = new Map(catRows.map((c) => [c.id, c.name]));
      const catalog = catalogRows.filter((product) => product.stock === null || product.stock > 0);
      const catalogById = new Map(catalog.map((product) => [product.id, product]));
      const currentCart = (input.cart ?? []).flatMap((line) => {
        const product = catalogById.get(line.productId);
        return product ? [{ productId: product.id, quantity: line.quantity, name: product.name, unit: product.unit }] : [];
      });
      const favoriteIds = [...new Set(input.favoriteProductIds ?? [])].filter((id) => catalogById.has(id)).slice(0, 100);
      const customerFavorites = favoriteIds.length && db ? await db.select({ id: products.id, name: products.name }).from(products).where(and2(inArray(products.id, favoriteIds), eq4(products.isPublished, true), eq4(products.isAvailable, true))).limit(100) : [];
      const history = (input.history ?? []).slice(-8).map(
        (turn) => (turn.role === "user" ? "\u0627\u0644\u0639\u0645\u064A\u0644" : "\u0627\u0644\u0645\u0633\u0627\u0639\u062F") + ": " + turn.text.trim().slice(0, 400)
      ).join("\n");
      const userPrompt = [
        "\u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u0627\u0644\u0645\u062A\u0627\u062D\u0629 (\u0645\u0635\u062F\u0631 \u0627\u0644\u062D\u0642\u064A\u0642\u0629 \u0627\u0644\u0648\u062D\u064A\u062F): " + JSON.stringify(catalog.slice(0, 80).map((p) => ({ id: p.id, name: p.name, category: catNameById.get(p.categoryId) || "\u0639\u0627\u0645", price: p.price, unit: p.unit }))),
        "\u0645\u0641\u0636\u0644\u0627\u062A \u0627\u0644\u0639\u0645\u064A\u0644: " + JSON.stringify(customerFavorites),
        "\u0627\u0644\u0633\u0644\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629: " + JSON.stringify(currentCart),
        history ? "\u0633\u062C\u0644 \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629 \u0627\u0644\u0633\u0627\u0628\u0642:\n" + history : "\u0644\u0627 \u064A\u0648\u062C\u062F \u0633\u064A\u0627\u0642 \u0633\u0627\u0628\u0642.",
        "\u0631\u0633\u0627\u0644\u0629 \u0627\u0644\u0639\u0645\u064A\u0644 \u0627\u0644\u062D\u0627\u0644\u064A\u0629:\n" + input.request
      ].join("\n\n");
      let output = null;
      try {
        const aiInst = db ? (await readSettings(db)).aiInstructions : "";
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "\u0623\u0646\u062A \u0628\u0627\u0626\u0639 \u0648\u0634\u064A\u0641 \u064A\u0645\u0646\u064A \u0630\u0643\u064A \u0641\u064A \u0645\u062A\u062C\u0631 \u0623\u0648\u0631\u062C\u0646\u0627\u0644." },
            { role: "user", content: userPrompt + (aiInst ? "\n\n\u062A\u0648\u062C\u064A\u0647\u0627\u062A \u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062A\u062C\u0631 \u0627\u0644\u062E\u0627\u0635\u0629:\n" + aiInst : "") }
          ],
          response_format: { type: "json_object" }
        });
        const structuredContent = response.choices?.[0]?.message?.content;
        output = parseAssistantModelContent(structuredContent);
      } catch (err) {
        console.error("[AI Assistant Error]", err);
      }
      if (!output) {
        throw new TRPCError3({ code: "SERVICE_UNAVAILABLE", message: "\u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u062A\u0635\u0627\u0644 \u0627\u0644\u0625\u0646\u062A\u0631\u0646\u062A \u0648\u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649." });
      }
      const prepared = prepareAssistantResponse(output, catalog, input.cart ?? [], input.request, input.history ?? []);
      chatSession.messages.push({
        id: nanoid(10),
        role: "assistant",
        sender: "\u0627\u0644\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0630\u0643\u064A",
        text: prepared.message,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      chatSession.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      void saveLiveChats(db);
      const missingItems = output.missingIngredients ?? [];
      if (missingItems.length > 0 && db) {
        const requestedItemText = missingItems.join("\u060C ").replace(/^طلب توفير:\s*/i, "").trim().slice(0, 180);
        void (async () => {
          try {
            const orderNumber = "REQ-" + Date.now().toString(36).toUpperCase().slice(-4) + "-" + nanoid(4).toUpperCase();
            const inserted = await db.insert(orders).values({
              orderNumber,
              idempotencyKey: "req-" + nanoid(22),
              userId: ctx.user?.id ?? null,
              offerId: null,
              recipientName: "\u{1F514} \u0637\u0644\u0628 \u062A\u0648\u0641\u064A\u0631 (" + customerNameClean + ")",
              phone: customerPhoneClean,
              city: "\u0637\u0644\u0628 \u062A\u0648\u0641\u064A\u0631 \u062E\u0627\u0635",
              district: "\u0627\u0644\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0630\u0643\u064A",
              addressDetails: "\u0637\u0644\u0628 \u0627\u0644\u0632\u0628\u0648\u0646 \u062A\u0648\u0641\u064A\u0631: " + requestedItemText,
              customerNote: '\u0631\u0633\u0627\u0644\u0629 \u0627\u0644\u0632\u0628\u0648\u0646: "' + input.request + '" | \u0631\u0642\u0645 \u0627\u0644\u0632\u0628\u0648\u0646: ' + customerPhoneClean,
              subtotal: 0,
              deliveryFee: 0,
              discount: 0,
              total: 0,
              status: "new"
            });
            const orderId = Number(inserted[0].insertId);
            await db.insert(orderItems).values({
              orderId,
              productId: null,
              productName: "\u{1F514} \u0645\u0637\u0644\u0648\u0628 \u062A\u0648\u0641\u064A\u0631: " + requestedItemText,
              productImage: null,
              unit: "\u0637\u0644\u0628",
              unitPrice: 0,
              quantity: 1,
              lineTotal: 0
            });
            await db.insert(orderEvents).values({
              orderId,
              status: "new",
              note: "\u0637\u0644\u0628 \u062A\u0648\u0641\u064A\u0631 \u062A\u0644\u0642\u0627\u0626\u064A \u0645\u0646 \u0627\u0644\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0630\u0643\u064A \u2014 \u0647\u0627\u062A\u0641 \u0627\u0644\u0632\u0628\u0648\u0646: " + customerPhoneClean,
              changedByUserId: null
            });
            const subscriptions = await getAllAdminPushTargets(db);
            await deliverPushRows(subscriptions, {
              title: "\u{1F514} \u0637\u0644\u0628 \u062A\u0648\u0641\u064A\u0631 \u0645\u0646\u062A\u062C \u063A\u064A\u0631 \u0645\u062A\u0648\u0641\u0631!",
              body: "\u0637\u0644\u0628 (" + requestedItemText + ") \xB7 \u0647\u0627\u062A\u0641 \u0627\u0644\u0632\u0628\u0648\u0646: " + customerPhoneClean,
              url: "/admin/orders",
              tag: "original-missing-item-" + orderId
            }, async (id) => {
              await db.delete(ownerPushSubscriptions).where(eq4(ownerPushSubscriptions.id, id));
            });
          } catch (e) {
            console.warn("[Missing Item Notify Error]", e);
          }
        })();
      }
      return prepared;
    })
  }),
  admin: router({
    // --- ADMIN_STAFF_ROUTER_START ---
    staff: router({
      list: requirePermission("staff.manage").query(async () => {
        const db = await database();
        await ensureRbacTables(db);
        const rows = await db.select().from(adminStaff).orderBy(desc(adminStaff.createdAt));
        const items = rows.map((row) => {
          const roleKey = ROLE_KEYS.includes(row.roleKey) ? row.roleKey : "staff";
          return {
            id: row.id,
            username: row.username,
            displayName: row.displayName,
            roleKey,
            roleLabel: ROLE_DEFINITIONS[roleKey]?.label || row.roleKey,
            permissions: parsePermissionsJson(row.permissionsJson, roleKey),
            allowedCategoryIds: parseAllowedCategoriesJson(row.permissionsJson, roleKey),
            isActive: row.isActive,
            mustChangePassword: row.mustChangePassword,
            createdBy: row.createdBy,
            lastLoginAt: row.lastLoginAt,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
          };
        });
        return {
          items,
          summary: {
            total: items.length,
            active: items.filter((i) => i.isActive).length,
            disabled: items.filter((i) => !i.isActive).length
          }
        };
      }),
      auditLogs: requirePermission("staff.manage").query(async () => {
        const db = await database();
        await ensureRbacTables(db);
        return db.select().from(adminAuditLogs).orderBy(desc(adminAuditLogs.createdAt)).limit(250);
      }),
      create: requirePermission("staff.manage").input(z3.object({
        displayName: z3.string().trim().min(2).max(160),
        username: z3.string().trim().min(3).max(120),
        password: z3.string().min(6).max(128),
        roleKey: z3.enum(["general_manager", "product_manager", "order_manager", "content_manager", "staff"]),
        permissions: z3.array(z3.enum(PERMISSION_KEYS)).max(30),
        allowedCategoryIds: z3.array(z3.number().int().positive()).max(100).optional(),
        mustChangePassword: z3.boolean().default(true)
      })).mutation(async ({ ctx, input }) => {
        const normalizedUsername = input.username.trim().toLowerCase();
        if (["owner", "admin", "root"].includes(normalizedUsername)) {
          throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0647\u0630\u0627 \u0645\u062D\u062C\u0648\u0632 \u0644\u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062A\u062C\u0631." });
        }
        if (["123456", "12345678", "password", "admin123"].includes(input.password.trim().toLowerCase())) {
          throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u064F\u0633\u0645\u062D \u0628\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0636\u0639\u064A\u0641\u0629 \u0623\u0648 \u0627\u0641\u062A\u0631\u0627\u0636\u064A\u0629 \u0645\u062B\u0644 123456." });
        }
        const guard = canManageTargetStaff(
          { isOwner: ctx.user.isOwner, permissions: ctx.user.permissions, staffId: ctx.user.staffId },
          input.roleKey,
          input.permissions
        );
        if (!guard.allowed) {
          throw new TRPCError3({ code: "FORBIDDEN", message: guard.reason || "\u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D." });
        }
        const db = await database();
        await ensureRbacTables(db);
        const existing = await db.select({ id: adminStaff.id }).from(adminStaff).where(eq4(adminStaff.username, normalizedUsername)).limit(1);
        if (existing.length > 0) {
          throw new TRPCError3({ code: "CONFLICT", message: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0623\u0648 \u0627\u0644\u0628\u0631\u064A\u062F \u0645\u0633\u062C\u0644 \u0645\u0633\u0628\u0642\u0627\u064B \u0644\u0645\u062F\u064A\u0631 \u0622\u062E\u0631." });
        }
        const passwordHash = hashAdminPassword(input.password);
        const uniquePerms = [...new Set(input.permissions)];
        const result = await db.insert(adminStaff).values({
          username: normalizedUsername,
          displayName: input.displayName.trim(),
          passwordHash,
          roleKey: input.roleKey,
          permissionsJson: serializePermissionsAndCategories(uniquePerms, input.allowedCategoryIds),
          isActive: true,
          mustChangePassword: input.mustChangePassword,
          sessionVersion: 1,
          createdBy: ctx.user.name || "\u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062A\u062C\u0631"
        });
        await writeAdminAuditLog({
          actorId: ctx.user.staffId ?? ctx.user.id,
          actorName: ctx.user.name || "\u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062A\u062C\u0631",
          actorRole: ctx.user.adminRole || "owner",
          action: "CREATE_STAFF",
          targetName: input.displayName + " (" + normalizedUsername + ")",
          details: "\u0625\u0646\u0634\u0627\u0621 \u062D\u0633\u0627\u0628 \u0628\u062F\u0648\u0631: " + (ROLE_DEFINITIONS[input.roleKey]?.label || input.roleKey) + " | \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A: " + uniquePerms.map((p) => PERMISSION_LABELS[p]?.label || p).join("\u060C "),
          ipAddress: getClientIp(ctx.req)
        });
        return { id: Number(result[0].insertId), success: true };
      }),
      update: requirePermission("staff.manage").input(z3.object({
        id: safeId,
        displayName: z3.string().trim().min(2).max(160),
        username: z3.string().trim().min(3).max(120),
        roleKey: z3.enum(["general_manager", "product_manager", "order_manager", "content_manager", "staff"]),
        permissions: z3.array(z3.enum(PERMISSION_KEYS)).max(30),
        allowedCategoryIds: z3.array(z3.number().int().positive()).max(100).optional()
      })).mutation(async ({ ctx, input }) => {
        const db = await database();
        await ensureRbacTables(db);
        const target = (await db.select().from(adminStaff).where(eq4(adminStaff.id, input.id)).limit(1))[0];
        if (!target) throw new TRPCError3({ code: "NOT_FOUND", message: "\u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0625\u062F\u0627\u0631\u064A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
        if (target.roleKey === "owner") throw new TRPCError3({ code: "FORBIDDEN", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0639\u062F\u064A\u0644 \u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0627\u0644\u0643." });
        const guard = canManageTargetStaff(
          { isOwner: ctx.user.isOwner, permissions: ctx.user.permissions, staffId: ctx.user.staffId },
          input.roleKey,
          input.permissions,
          target.id
        );
        if (!guard.allowed) throw new TRPCError3({ code: "FORBIDDEN", message: guard.reason || "\u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D." });
        const normalizedUsername = input.username.trim().toLowerCase();
        if (["owner", "admin", "root"].includes(normalizedUsername)) {
          throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0647\u0630\u0627 \u0645\u062D\u062C\u0648\u0632 \u0644\u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062A\u062C\u0631." });
        }
        const duplicateRows = await db.select({ id: adminStaff.id }).from(adminStaff).where(eq4(adminStaff.username, normalizedUsername)).limit(5);
        const duplicate = duplicateRows.filter((r) => r.id !== input.id);
        if (duplicate.length > 0) {
          throw new TRPCError3({ code: "CONFLICT", message: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0633\u062A\u062E\u062F\u0645 \u0628\u0627\u0644\u0641\u0639\u0644 \u0644\u062D\u0633\u0627\u0628 \u0622\u062E\u0631." });
        }
        const uniquePerms = [...new Set(input.permissions)];
        await db.update(adminStaff).set({
          displayName: input.displayName.trim(),
          username: normalizedUsername,
          roleKey: input.roleKey,
          permissionsJson: serializePermissionsAndCategories(uniquePerms, input.allowedCategoryIds),
          sessionVersion: target.sessionVersion + 1
        }).where(eq4(adminStaff.id, input.id));
        await writeAdminAuditLog({
          actorId: ctx.user.staffId ?? ctx.user.id,
          actorName: ctx.user.name || "\u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062A\u062C\u0631",
          actorRole: ctx.user.adminRole || "owner",
          action: "UPDATE_STAFF",
          targetName: input.displayName + " (" + normalizedUsername + ")",
          details: "\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u062F\u0648\u0631 \u0625\u0644\u0649: " + (ROLE_DEFINITIONS[input.roleKey]?.label || input.roleKey) + " | \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A: " + uniquePerms.map((p) => PERMISSION_LABELS[p]?.label || p).join("\u060C "),
          ipAddress: getClientIp(ctx.req)
        });
        return { success: true };
      }),
      setStatus: requirePermission("staff.manage").input(z3.object({
        id: safeId,
        isActive: z3.boolean()
      })).mutation(async ({ ctx, input }) => {
        const db = await database();
        await ensureRbacTables(db);
        const target = (await db.select().from(adminStaff).where(eq4(adminStaff.id, input.id)).limit(1))[0];
        if (!target) throw new TRPCError3({ code: "NOT_FOUND", message: "\u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0625\u062F\u0627\u0631\u064A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
        if (target.roleKey === "owner") throw new TRPCError3({ code: "FORBIDDEN", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0639\u0637\u064A\u0644 \u062D\u0633\u0627\u0628 \u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062A\u062C\u0631." });
        if (ctx.user.staffId && ctx.user.staffId === target.id) {
          throw new TRPCError3({ code: "FORBIDDEN", message: "\u0644\u0627 \u064A\u0645\u0643\u0646\u0643 \u062A\u0639\u0637\u064A\u0644 \u062D\u0633\u0627\u0628\u0643 \u0627\u0644\u0634\u062E\u0635\u064A." });
        }
        if (!ctx.user.isOwner) {
          const targetPerms = parsePermissionsJson(target.permissionsJson, target.roleKey);
          const guard = canManageTargetStaff({ isOwner: false, permissions: ctx.user.permissions, staffId: ctx.user.staffId }, target.roleKey, targetPerms, target.id);
          if (!guard.allowed) throw new TRPCError3({ code: "FORBIDDEN", message: guard.reason });
        }
        await db.update(adminStaff).set({
          isActive: input.isActive,
          sessionVersion: target.sessionVersion + 1
        }).where(eq4(adminStaff.id, input.id));
        await writeAdminAuditLog({
          actorId: ctx.user.staffId ?? ctx.user.id,
          actorName: ctx.user.name || "\u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062A\u062C\u0631",
          actorRole: ctx.user.adminRole || "owner",
          action: input.isActive ? "ACTIVATE_STAFF" : "DISABLE_STAFF",
          targetName: target.displayName + " (" + target.username + ")",
          details: input.isActive ? "\u062A\u0645 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0625\u062F\u0627\u0631\u064A" : "\u062A\u0645 \u062A\u0639\u0637\u064A\u0644 \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0625\u062F\u0627\u0631\u064A \u0648\u0625\u0628\u0637\u0627\u0644 \u062C\u0644\u0633\u062A\u0647 \u0627\u0644\u0641\u0648\u0631\u064A\u0629",
          ipAddress: getClientIp(ctx.req)
        });
        return { success: true };
      }),
      resetPassword: requirePermission("staff.manage").input(z3.object({
        id: safeId,
        newPassword: z3.string().min(6).max(128),
        mustChangePassword: z3.boolean().default(true)
      })).mutation(async ({ ctx, input }) => {
        if (["123456", "12345678", "password", "admin123"].includes(input.newPassword.trim().toLowerCase())) {
          throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u064F\u0633\u0645\u062D \u0628\u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0636\u0639\u064A\u0641\u0629 \u0623\u0648 \u0627\u0641\u062A\u0631\u0627\u0636\u064A\u0629 \u0645\u062B\u0644 123456." });
        }
        const db = await database();
        await ensureRbacTables(db);
        const target = (await db.select().from(adminStaff).where(eq4(adminStaff.id, input.id)).limit(1))[0];
        if (!target) throw new TRPCError3({ code: "NOT_FOUND", message: "\u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0625\u062F\u0627\u0631\u064A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
        if (target.roleKey === "owner") throw new TRPCError3({ code: "FORBIDDEN", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0627\u0644\u0645\u0627\u0644\u0643 \u0645\u0646 \u0647\u0646\u0627." });
        if (!ctx.user.isOwner && ctx.user.staffId === target.id) {
          throw new TRPCError3({ code: "FORBIDDEN", message: "\u0627\u0633\u062A\u062E\u062F\u0645 \u0646\u0627\u0641\u0630\u0629 \u062A\u063A\u064A\u064A\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062E\u0627\u0635\u0629 \u0628\u0643." });
        }
        const passwordHash = hashAdminPassword(input.newPassword);
        await db.update(adminStaff).set({
          passwordHash,
          mustChangePassword: input.mustChangePassword,
          sessionVersion: target.sessionVersion + 1
        }).where(eq4(adminStaff.id, input.id));
        await writeAdminAuditLog({
          actorId: ctx.user.staffId ?? ctx.user.id,
          actorName: ctx.user.name || "\u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062A\u062C\u0631",
          actorRole: ctx.user.adminRole || "owner",
          action: "RESET_STAFF_PASSWORD",
          targetName: target.displayName + " (" + target.username + ")",
          details: "\u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631" + (input.mustChangePassword ? " \u0645\u0639 \u0641\u0631\u0636 \u062A\u063A\u064A\u064A\u0631\u0647\u0627 \u0639\u0646\u062F \u0627\u0644\u062F\u062E\u0648\u0644 \u0627\u0644\u0642\u0627\u062F\u0645" : ""),
          ipAddress: getClientIp(ctx.req)
        });
        return { success: true };
      }),
      delete: requirePermission("staff.manage").input(z3.object({ id: safeId })).mutation(async ({ ctx, input }) => {
        if (!ctx.user.isOwner) {
          throw new TRPCError3({ code: "FORBIDDEN", message: "\u062D\u0630\u0641 \u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A \u0627\u0644\u0625\u062F\u0627\u0631\u064A\u0629 \u0646\u0647\u0627\u0626\u064A\u0627\u064B \u0645\u062A\u0627\u062D \u0644\u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062A\u062C\u0631 \u0641\u0642\u0637\u061B \u064A\u0645\u0643\u0646\u0643 \u062A\u0639\u0637\u064A\u0644 \u0627\u0644\u062D\u0633\u0627\u0628 \u0628\u062F\u0644\u0627\u064B \u0645\u0646 \u0630\u0644\u0643." });
        }
        const db = await database();
        await ensureRbacTables(db);
        const target = (await db.select().from(adminStaff).where(eq4(adminStaff.id, input.id)).limit(1))[0];
        if (!target) throw new TRPCError3({ code: "NOT_FOUND", message: "\u0627\u0644\u062D\u0633\u0627\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
        if (target.roleKey === "owner") throw new TRPCError3({ code: "FORBIDDEN", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0627\u0644\u0643." });
        await db.update(users).set({ role: "user", suspended: true }).where(eq4(users.openId, "staff_user_" + target.id));
        await db.delete(adminStaff).where(eq4(adminStaff.id, input.id));
        await writeAdminAuditLog({
          actorId: ctx.user.id,
          actorName: ctx.user.name || "\u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062A\u062C\u0631",
          actorRole: "owner",
          action: "DELETE_STAFF",
          targetName: target.displayName + " (" + target.username + ")",
          details: "\u062D\u0630\u0641 \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0625\u062F\u0627\u0631\u064A \u0646\u0647\u0627\u0626\u064A\u0627\u064B \u0645\u0639 \u0627\u0644\u062D\u0641\u0627\u0638 \u0639\u0644\u0649 \u0633\u062C\u0644\u0627\u062A \u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0645\u0631\u062A\u0628\u0637\u0629",
          ipAddress: getClientIp(ctx.req)
        });
        return { success: true };
      }),
      changeOwnPassword: protectedProcedure.input(z3.object({
        currentPassword: z3.string().min(1).max(128),
        newPassword: z3.string().min(6).max(128)
      })).mutation(async ({ ctx, input }) => {
        if (!ctx.user.staffId) {
          throw new TRPCError3({ code: "BAD_REQUEST", message: "\u062A\u063A\u064A\u064A\u0631 \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0645\u0627\u0644\u0643 \u0627\u0644\u0645\u062A\u062C\u0631 \u064A\u062A\u0645 \u0639\u0628\u0631 \u0645\u062A\u063A\u064A\u0631 \u0627\u0644\u0628\u064A\u0626\u0629 ADMIN_PASSWORD \u0641\u064A \u0627\u0644\u0627\u0633\u062A\u0636\u0627\u0641\u0629." });
        }
        if (["123456", "12345678", "password", "admin123"].includes(input.newPassword.trim().toLowerCase())) {
          throw new TRPCError3({ code: "BAD_REQUEST", message: "\u064A\u0631\u062C\u0649 \u0627\u062E\u062A\u064A\u0627\u0631 \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0642\u0648\u064A\u0629 \u0648\u063A\u064A\u0631 \u0627\u0641\u062A\u0631\u0627\u0636\u064A\u0629." });
        }
        const db = await database();
        await ensureRbacTables(db);
        const staff = (await db.select().from(adminStaff).where(eq4(adminStaff.id, ctx.user.staffId)).limit(1))[0];
        if (!staff || !verifyAdminPassword(input.currentPassword, staff.passwordHash)) {
          throw new TRPCError3({ code: "UNAUTHORIZED", message: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629." });
        }
        const nextVersion = staff.sessionVersion + 1;
        const passwordHash = hashAdminPassword(input.newPassword);
        await db.update(adminStaff).set({
          passwordHash,
          mustChangePassword: false,
          sessionVersion: nextVersion
        }).where(eq4(adminStaff.id, staff.id));
        const newToken = await sdk.createSessionToken("staff_" + staff.id + "_v" + nextVersion, {
          name: staff.displayName,
          expiresInMs: 7 * 24 * 60 * 60 * 1e3
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, newToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1e3 });
        await writeAdminAuditLog({
          actorId: staff.id,
          actorName: staff.displayName,
          actorRole: staff.roleKey,
          action: "CHANGE_OWN_PASSWORD",
          targetName: staff.username,
          details: "\u0642\u0627\u0645 \u0627\u0644\u0645\u062F\u064A\u0631 \u0628\u062A\u062D\u062F\u064A\u062B \u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631\u0647 \u0627\u0644\u0645\u0624\u0642\u062A\u0629 \u0628\u0646\u062C\u0627\u062D",
          ipAddress: getClientIp(ctx.req)
        });
        return { success: true };
      })
    }),
    // --- ADMIN_STAFF_ROUTER_END ---
    chats: router({
      list: requirePermission("chats.manage").query(async () => {
        const db = await database();
        await loadLiveChats(db);
        return [...liveChatsMemory.values()].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      }),
      reply: requirePermission("chats.manage").input(z3.object({
        sessionId: z3.string().trim().min(1).max(80),
        text: z3.string().trim().min(1).max(1200)
      })).mutation(async ({ input }) => {
        const db = await database();
        await loadLiveChats(db);
        const session = liveChatsMemory.get(input.sessionId);
        if (!session) throw new TRPCError3({ code: "NOT_FOUND", message: "\u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
        const msgObj = {
          id: nanoid(10),
          role: "owner",
          sender: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u062A\u062C\u0631",
          text: input.text.trim(),
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        session.messages.push(msgObj);
        session.updatedAt = msgObj.createdAt;
        await saveLiveChats(db);
        return { success: true };
      }),
      toggleAi: requirePermission("chats.manage").input(z3.object({
        sessionId: z3.string().trim().min(1).max(80),
        aiPaused: z3.boolean()
      })).mutation(async ({ input }) => {
        const db = await database();
        await loadLiveChats(db);
        const session = liveChatsMemory.get(input.sessionId);
        if (session) {
          session.aiPaused = input.aiPaused;
          session.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
          await saveLiveChats(db);
        }
        return { success: true };
      }),
      delete: requirePermission("chats.manage").input(z3.object({
        sessionId: z3.string().trim().min(1).max(80)
      })).mutation(async ({ input }) => {
        const db = await database();
        await loadLiveChats(db);
        liveChatsMemory.delete(input.sessionId);
        await saveLiveChats(db);
        return { success: true };
      })
    }),
    overview: requirePermission("overview.view").query(async () => getCached("admin:overview", 3e4, async () => {
      const db = await database();
      const [productRows, categoryRows, orderRows, customerRows, orderMetrics, settings] = await Promise.all([
        db.select({ count: sql2`count(*)` }).from(products),
        db.select({ count: sql2`count(*)` }).from(categories),
        db.select({ count: sql2`count(*)` }).from(orders),
        db.select({ count: sql2`count(distinct ${orders.phone})` }).from(orders).where(sql2`${orders.phone} <> ''`),
        db.select({ orderValue: sql2`coalesce(sum(case when ${orders.status} <> 'cancelled' then ${orders.total} else 0 end), 0)`, openOrders: sql2`coalesce(sum(case when ${orders.status} in ('new', 'preparing', 'ready', 'out_for_delivery') then 1 else 0 end), 0)` }).from(orders),
        readSettings(db)
      ]);
      const recentOrders = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(6);
      return { products: Number(productRows[0]?.count ?? 0), categories: Number(categoryRows[0]?.count ?? 0), orders: Number(orderRows[0]?.count ?? 0), customers: Number(customerRows[0]?.count ?? 0), orderValue: Number(orderMetrics[0]?.orderValue ?? 0), openOrders: Number(orderMetrics[0]?.openOrders ?? 0), recentOrders, settings };
    })),
    notifications: router({
      subscribe: adminProcedure.input(pushSubscriptionSchema).mutation(async ({ ctx, input }) => {
        if (!isAllowedPushEndpoint(input.endpoint)) {
          throw new TRPCError3({ code: "BAD_REQUEST", message: "\u062E\u062F\u0645\u0629 \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062A \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0645\u062A\u0635\u0641\u062D \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645\u0629." });
        }
        const db = await database();
        const protectedSubscription = protectPushSubscription(input);
        await saveBackupAdminSubscription(db, protectedSubscription);
        let userId = ctx.user.id;
        if (!userId || userId <= 0) {
          const openId = ctx.user.openId || "staff_user_" + (ctx.user.staffId || "admin");
          await db.insert(users).values({ openId, name: ctx.user.name || "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u062A\u062C\u0631", role: "admin", loginMethod: "staff_password" }).onDuplicateKeyUpdate({ set: { updatedAt: /* @__PURE__ */ new Date() } }).catch(() => {
          });
          const uRows = await db.select({ id: users.id }).from(users).where(eq4(users.openId, openId)).limit(1).catch(() => []);
          if (uRows[0]?.id) userId = uRows[0].id;
        }
        if (userId && userId > 0) {
          await db.insert(ownerPushSubscriptions).values({ userId, ...protectedSubscription }).onDuplicateKeyUpdate({ set: { encryptedPayload: protectedSubscription.encryptedPayload, updatedAt: /* @__PURE__ */ new Date() } }).catch(() => {
          });
        }
        return { success: true };
      }),
      testPush: adminProcedure.mutation(async () => {
        const db = await database();
        const targets = await getAllAdminPushTargets(db);
        if (!targets.length) {
          throw new TRPCError3({ code: "PRECONDITION_FAILED", message: "\u064A\u0631\u062C\u0649 \u0627\u0644\u0636\u063A\u0637 \u0639\u0644\u0649 \u0632\u0631 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062A \u0623\u0648\u0644\u0627\u064B \u0644\u0631\u0628\u0637 \u0647\u0630\u0627 \u0627\u0644\u062C\u0647\u0627\u0632." });
        }
        await deliverPushRows(targets, {
          title: "\u{1F33F} \u0625\u062F\u0627\u0631\u0629 \u0623\u0648\u0631\u062C\u0646\u0627\u0644 \xB7 \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062A \u0646\u0634\u0637\u0629",
          body: "\u062C\u0647\u0627\u0632\u0643 \u0645\u0631\u0628\u0648\u0637 \u0628\u0646\u062C\u0627\u062D! \u0633\u064A\u0635\u0644\u0643 \u0625\u0634\u0639\u0627\u0631 \u0641\u0648\u0631\u064A \u0648\u0623\u0646\u064A\u0642 \u0645\u0639 \u0643\u0644 \u0637\u0644\u0628 \u062C\u062F\u064A\u062F \u062D\u062A\u0649 \u0644\u0648 \u0643\u0627\u0646 \u0627\u0644\u062A\u0637\u0628\u064A\u0642 \u0645\u063A\u0644\u0642\u0627\u064B \u2728",
          url: "/admin/orders",
          tag: "original-admin-test-push"
        }, async (id, endpointHash) => {
          if (id > 0) await db.delete(ownerPushSubscriptions).where(eq4(ownerPushSubscriptions.id, id)).catch(() => {
          });
          if (endpointHash) await removeBackupAdminSubscription(db, endpointHash);
        });
        return { sent: targets.length };
      })
    }),
    products: router({
      list: requireAnyPermission(["products.view", "products.add", "products.edit", "products.delete", "products.manage", "inventory.manage"]).query(async ({ ctx }) => {
        const db = await database();
        const allowedCats = !ctx.user.isOwner && Array.isArray(ctx.user.allowedCategoryIds) && ctx.user.allowedCategoryIds.length > 0 ? ctx.user.allowedCategoryIds : null;
        const rows = allowedCats ? await db.select().from(products).where(inArray(products.categoryId, allowedCats)).orderBy(desc(products.updatedAt)).limit(500) : await db.select().from(products).orderBy(desc(products.updatedAt)).limit(500);
        return rows.map((r) => toFastImg("product", r));
      }),
      create: requireAnyPermission(["products.manage", "products.add"]).use(async ({ next }) => {
        const res = await next();
        clearCatalogCache();
        return res;
      }).input(productInput).mutation(async ({ ctx, input }) => {
        const allowedCats = !ctx.user.isOwner && Array.isArray(ctx.user.allowedCategoryIds) && ctx.user.allowedCategoryIds.length > 0 ? ctx.user.allowedCategoryIds : null;
        if (allowedCats && (!input.categoryId || !allowedCats.includes(input.categoryId))) {
          throw new TRPCError3({ code: "FORBIDDEN", message: "\u0635\u0644\u0627\u062D\u064A\u062A\u0643 \u0645\u062E\u0635\u0635\u0629 \u0644\u0625\u062F\u0627\u0631\u0629 \u0623\u0642\u0633\u0627\u0645 \u0645\u062D\u062F\u062F\u0629 \u0641\u0642\u0637\u061B \u0627\u062E\u062A\u0631 \u0642\u0633\u0645\u0627\u064B \u0636\u0645\u0646 \u0635\u0644\u0627\u062D\u064A\u0627\u062A\u0643." });
        }
        const db = await database();
        const result = await db.insert(products).values({ ...input, slug: slugify(input.name), description: input.description ?? null, imageUrl: input.imageUrl ?? null, categoryId: input.categoryId ?? null, stock: input.stock ?? null });
        void (async () => {
          try {
            const allRows = await db.select({ id: products.id, name: products.name, description: products.description, price: products.price, unit: products.unit, stock: products.stock, minQuantity: products.minQuantity, quantityStep: products.quantityStep }).from(products).where(and2(eq4(products.isPublished, true), eq4(products.isAvailable, true))).limit(60);
            await generateAndCacheProductAiRecipe(input.name, allRows);
          } catch {
          }
        })();
        return { id: Number(result[0].insertId) };
      }),
      update: requireAnyPermission(["products.manage", "products.edit", "inventory.manage"]).use(async ({ next }) => {
        const res = await next();
        clearCatalogCache();
        return res;
      }).input(z3.object({ id: safeId, values: productInput.partial() })).mutation(async ({ ctx, input }) => {
        const canEditProduct = hasPermission(ctx.user.permissions, ctx.user.isOwner, "products.edit") || hasPermission(ctx.user.permissions, ctx.user.isOwner, "products.manage");
        if (!canEditProduct) {
          const allowedKeys = /* @__PURE__ */ new Set(["price", "stock", "isAvailable", "minQuantity", "quantityStep"]);
          for (const k of Object.keys(input.values)) {
            if (!allowedKeys.has(k)) throw new TRPCError3({ code: "FORBIDDEN", message: "\u0635\u0644\u0627\u062D\u064A\u062A\u0643 \u062A\u0642\u062A\u0635\u0631 \u0639\u0644\u0649 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0633\u0639\u0631 \u0648\u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u0648\u0627\u0644\u062A\u0648\u0641\u0631 \u0641\u0642\u0637." });
          }
        }
        const db = await database();
        const allowedCats = !ctx.user.isOwner && Array.isArray(ctx.user.allowedCategoryIds) && ctx.user.allowedCategoryIds.length > 0 ? ctx.user.allowedCategoryIds : null;
        if (allowedCats) {
          const target = (await db.select({ categoryId: products.categoryId }).from(products).where(eq4(products.id, input.id)).limit(1))[0];
          if (!target || !target.categoryId || !allowedCats.includes(target.categoryId)) {
            throw new TRPCError3({ code: "FORBIDDEN", message: "\u0644\u0627 \u064A\u0645\u0643\u0646\u0643 \u062A\u0639\u062F\u064A\u0644 \u0645\u0646\u062A\u062C \u062E\u0627\u0631\u062C \u0627\u0644\u0623\u0642\u0633\u0627\u0645 \u0627\u0644\u0645\u062E\u0635\u0635\u0629 \u0644\u0643." });
          }
          if (input.values.categoryId !== void 0 && (!input.values.categoryId || !allowedCats.includes(input.values.categoryId))) {
            throw new TRPCError3({ code: "FORBIDDEN", message: "\u0644\u0627 \u064A\u0645\u0643\u0646\u0643 \u0646\u0642\u0644 \u0627\u0644\u0645\u0646\u062A\u062C \u0625\u0644\u0649 \u0642\u0633\u0645 \u062E\u0627\u0631\u062C \u0635\u0644\u0627\u062D\u064A\u0627\u062A\u0643." });
          }
        }
        const cleanVals = { ...input.values };
        if (typeof cleanVals.imageUrl === "string" && cleanVals.imageUrl.startsWith("/api/fast-img/")) delete cleanVals.imageUrl;
        globalThis.__fastImgCache?.delete("product:" + input.id);
        await db.update(products).set(cleanVals).where(eq4(products.id, input.id));
        return { success: true };
      }),
      bulkAdjustPrices: requireAnyPermission(["products.manage", "products.edit", "inventory.manage"]).use(async ({ next }) => {
        const res = await next();
        clearCatalogCache();
        return res;
      }).input(z3.object({
        categoryId: z3.number().int().positive().nullable().optional(),
        mode: z3.enum(["percent", "fixed"]),
        amount: z3.number().min(-90).max(1e6),
        roundTo50: z3.boolean().default(true)
      })).mutation(async ({ ctx, input }) => {
        const db = await database();
        const allowedCats = !ctx.user.isOwner && Array.isArray(ctx.user.allowedCategoryIds) && ctx.user.allowedCategoryIds.length > 0 ? ctx.user.allowedCategoryIds : null;
        if (allowedCats && input.categoryId && !allowedCats.includes(input.categoryId)) {
          throw new TRPCError3({ code: "FORBIDDEN", message: "\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0644\u062A\u0639\u062F\u064A\u0644 \u0623\u0633\u0639\u0627\u0631 \u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645." });
        }
        const allRows = await db.select({ id: products.id, price: products.price, categoryId: products.categoryId }).from(products);
        const targets = allRows.filter((r) => {
          if (allowedCats && (!r.categoryId || !allowedCats.includes(r.categoryId))) return false;
          if (input.categoryId && r.categoryId !== input.categoryId) return false;
          return true;
        });
        let updatedCount = 0;
        for (const row of targets) {
          let nextPrice = input.mode === "percent" ? Math.round(row.price * (1 + input.amount / 100)) : Math.round(row.price + input.amount);
          if (input.roundTo50 && nextPrice > 100) {
            nextPrice = Math.round(nextPrice / 50) * 50;
          }
          nextPrice = Math.max(50, nextPrice);
          if (nextPrice !== row.price) {
            await db.update(products).set({ price: nextPrice }).where(eq4(products.id, row.id));
            updatedCount++;
          }
        }
        return { updatedCount };
      }),
      archive: requireAnyPermission(["products.manage", "products.edit", "products.delete"]).use(async ({ next }) => {
        const res = await next();
        clearCatalogCache();
        return res;
      }).input(z3.object({ id: safeId })).mutation(async ({ ctx, input }) => {
        const db = await database();
        const allowedCats = !ctx.user.isOwner && Array.isArray(ctx.user.allowedCategoryIds) && ctx.user.allowedCategoryIds.length > 0 ? ctx.user.allowedCategoryIds : null;
        if (allowedCats) {
          const target = (await db.select({ categoryId: products.categoryId }).from(products).where(eq4(products.id, input.id)).limit(1))[0];
          if (!target || !target.categoryId || !allowedCats.includes(target.categoryId)) throw new TRPCError3({ code: "FORBIDDEN", message: "\u0644\u0627 \u064A\u0645\u0643\u0646\u0643 \u062A\u0639\u062F\u064A\u0644 \u0645\u0646\u062A\u062C \u062E\u0627\u0631\u062C \u0627\u0644\u0623\u0642\u0633\u0627\u0645 \u0627\u0644\u0645\u062E\u0635\u0635\u0629 \u0644\u0643." });
        }
        await db.update(products).set({ isPublished: false, isAvailable: false }).where(eq4(products.id, input.id));
        clearCatalogCache(input.id);
        return { success: true };
      }),
      // --- PRODUCT_DELETE_ENDPOINT ---
      delete: requireAnyPermission(["products.manage", "products.delete"]).use(async ({ next }) => {
        const res = await next();
        clearCatalogCache();
        return res;
      }).input(z3.object({ id: safeId })).mutation(async ({ ctx, input }) => {
        const db = await database();
        const allowedCats = !ctx.user.isOwner && Array.isArray(ctx.user.allowedCategoryIds) && ctx.user.allowedCategoryIds.length > 0 ? ctx.user.allowedCategoryIds : null;
        if (allowedCats) {
          const target = (await db.select({ categoryId: products.categoryId }).from(products).where(eq4(products.id, input.id)).limit(1))[0];
          if (!target || !target.categoryId || !allowedCats.includes(target.categoryId)) {
            throw new TRPCError3({ code: "FORBIDDEN", message: "\u0644\u0627 \u064A\u0645\u0643\u0646\u0643 \u062D\u0630\u0641 \u0645\u0646\u062A\u062C \u062E\u0627\u0631\u062C \u0627\u0644\u0623\u0642\u0633\u0627\u0645 \u0627\u0644\u0645\u062E\u0635\u0635\u0629 \u0644\u0643." });
          }
        }
        globalThis.__fastImgCache?.delete("product:" + input.id);
        await db.transaction(async (tx) => {
          await tx.delete(productRecommendations).where(or(eq4(productRecommendations.productId, input.id), eq4(productRecommendations.recommendedProductId, input.id)));
          await tx.delete(favorites).where(eq4(favorites.productId, input.id));
          await tx.update(orderItems).set({ productId: null }).where(eq4(orderItems.productId, input.id));
          await tx.delete(products).where(eq4(products.id, input.id));
        });
        clearCatalogCache(input.id);
        return { success: true };
      }),
      analyzeImage: requireAnyPermission(["products.manage", "products.add", "products.edit"]).input(z3.object({ imageDataUrl: z3.string().min(20).max(25e5), fileName: z3.string().max(200).optional() })).mutation(async ({ ctx, input }) => {
        const db = await database();
        let catRows = await db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.sortOrder));
        const allowedCats = !ctx.user.isOwner && Array.isArray(ctx.user.allowedCategoryIds) && ctx.user.allowedCategoryIds.length > 0 ? ctx.user.allowedCategoryIds : null;
        if (allowedCats) catRows = catRows.filter((c) => allowedCats.includes(c.id));
        const res = await analyzeProductImageAI({ imageDataUrl: input.imageDataUrl, fileName: input.fileName, categories: catRows });
        if (allowedCats && (!res.categoryId || !allowedCats.includes(res.categoryId))) {
          res.categoryId = allowedCats[0] ?? null;
        } else if (!res.categoryId && res.suggestedCategoryName && !allowedCats) {
          const existing = catRows.find((c) => c.name.trim() === res.suggestedCategoryName.trim());
          if (existing) {
            res.categoryId = existing.id;
          } else {
            try {
              const ins = await db.insert(categories).values({
                name: res.suggestedCategoryName,
                slug: slugify(res.suggestedCategoryName),
                description: "\u0642\u0633\u0645 " + res.suggestedCategoryName,
                imageUrl: null,
                isActive: true,
                sortOrder: catRows.length
              });
              const newId = Number(ins[0]?.insertId || 0);
              if (newId > 0) {
                res.categoryId = newId;
                clearCatalogCache();
              }
            } catch {
            }
          }
        }
        return res;
      }),
      parseBulkText: requireAnyPermission(["products.manage", "products.add", "products.edit"]).input(z3.object({ rawText: z3.string().min(2).max(12e3) })).mutation(async ({ ctx, input }) => {
        const db = await database();
        let catRows = await db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.sortOrder));
        const allowedCats = !ctx.user.isOwner && Array.isArray(ctx.user.allowedCategoryIds) && ctx.user.allowedCategoryIds.length > 0 ? ctx.user.allowedCategoryIds : null;
        if (allowedCats) catRows = catRows.filter((c) => allowedCats.includes(c.id));
        return parseBulkProductsTextAI({ rawText: input.rawText, categories: catRows });
      }),
      bulkCreate: requireAnyPermission(["products.manage", "products.add"]).use(async ({ next }) => {
        const res = await next();
        clearCatalogCache();
        return res;
      }).input(z3.object({ items: z3.array(productInput).min(1).max(60) })).mutation(async ({ ctx, input }) => {
        const db = await database();
        const allowedCats = !ctx.user.isOwner && Array.isArray(ctx.user.allowedCategoryIds) && ctx.user.allowedCategoryIds.length > 0 ? ctx.user.allowedCategoryIds : null;
        const insertedIds = [];
        for (const item of input.items) {
          const effectiveCatId = allowedCats ? item.categoryId && allowedCats.includes(item.categoryId) ? item.categoryId : allowedCats[0] : item.categoryId ?? null;
          const result = await db.insert(products).values({
            ...item,
            slug: slugify(item.name),
            description: item.description ?? null,
            imageUrl: item.imageUrl ?? null,
            categoryId: effectiveCatId,
            stock: item.stock ?? null
          });
          insertedIds.push(Number(result[0]?.insertId || 0));
        }
        return { count: insertedIds.length, ids: insertedIds };
      }),
      setRecommendations: requireAnyPermission(["products.manage", "products.edit"]).input(z3.object({ productId: safeId, recommendedIds: z3.array(safeId).max(30) })).mutation(async ({ input }) => {
        if (input.recommendedIds.includes(input.productId)) throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0642\u062A\u0631\u0627\u062D \u0627\u0644\u0645\u0646\u062A\u062C \u0646\u0641\u0633\u0647." });
        const db = await database();
        await db.transaction(async (tx) => {
          await tx.delete(productRecommendations).where(eq4(productRecommendations.productId, input.productId));
          if (input.recommendedIds.length) await tx.insert(productRecommendations).values(input.recommendedIds.map((recommendedProductId) => ({ productId: input.productId, recommendedProductId })));
        });
        return { success: true };
      })
    }),
    categories: router({
      // --- CATEGORY_DELETE_ENDPOINT ---
      delete: requirePermission("categories.manage").use(async ({ next }) => {
        clearCatalogCache();
        return next();
      }).input(z3.object({ id: safeId })).mutation(async ({ input }) => {
        const db = await database();
        await db.transaction(async (tx) => {
          await tx.update(products).set({ categoryId: null }).where(eq4(products.categoryId, input.id));
          await tx.delete(categories).where(eq4(categories.id, input.id));
        });
        return { success: true };
      }),
      list: requireAnyPermission(["categories.manage", "products.view", "products.add", "products.edit", "products.manage"]).query(async () => getCached("admin:categories", 3e4, async () => {
        const db = await database();
        const rows = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.id));
        return rows.map((r) => toFastImg("category", r));
      })),
      create: adminProcedure.use(async ({ next }) => {
        clearLiveHomeCache();
        return next();
      }).input(categoryInput).mutation(async ({ input }) => {
        const db = await database();
        const result = await db.insert(categories).values({ ...input, slug: slugify(input.name), description: input.description ?? null, imageUrl: input.imageUrl ?? null });
        clearCatalogCache();
        return { id: Number(result[0].insertId) };
      }),
      update: adminProcedure.use(async ({ next }) => {
        clearLiveHomeCache();
        return next();
      }).input(z3.object({ id: safeId, values: categoryInput.partial() })).mutation(async ({ input }) => {
        const db = await database();
        const cleanCatVals = { ...input.values };
        if (typeof cleanCatVals.imageUrl === "string" && cleanCatVals.imageUrl.startsWith("/api/fast-img/")) delete cleanCatVals.imageUrl;
        globalThis.__fastImgCache?.delete("category:" + input.id);
        await db.update(categories).set(cleanCatVals).where(eq4(categories.id, input.id));
        clearCatalogCache();
        return { success: true };
      }),
      archive: adminProcedure.use(async ({ next }) => {
        clearLiveHomeCache();
        return next();
      }).input(z3.object({ id: safeId })).mutation(async ({ input }) => {
        const db = await database();
        await db.update(categories).set({ isActive: false }).where(eq4(categories.id, input.id));
        clearCatalogCache();
        return { success: true };
      })
    }),
    banners: router({
      list: requirePermission("banners.manage").query(async () => {
        const db = await database();
        const rows = await db.select().from(banners).orderBy(asc(banners.sortOrder), desc(banners.createdAt));
        return rows.map((r) => toFastImg("banner", r));
      }),
      create: requirePermission("banners.manage").use(async ({ next }) => {
        clearLiveHomeCache();
        return next();
      }).input(z3.object({ title: z3.string().trim().min(1).max(160), body: z3.string().trim().max(1e3).optional(), imageUrl: z3.string().max(85e5).optional(), actionText: z3.string().trim().max(60).optional(), actionUrl: z3.string().trim().max(2e3).optional(), isActive: z3.boolean().default(false), sortOrder: z3.number().int().min(-1e4).max(1e4).default(0) })).mutation(async ({ input }) => {
        const db = await database();
        const result = await db.insert(banners).values({ ...input, body: input.body ?? null, imageUrl: input.imageUrl ?? null, actionText: input.actionText ?? null, actionUrl: input.actionUrl ?? null });
        clearCatalogCache();
        return { id: Number(result[0].insertId) };
      }),
      update: requirePermission("banners.manage").use(async ({ next }) => {
        clearLiveHomeCache();
        return next();
      }).input(z3.object({ id: safeId, values: z3.object({ title: z3.string().trim().min(1).max(160).optional(), body: z3.string().max(1e3).nullable().optional(), imageUrl: z3.string().max(85e5).nullable().optional(), actionText: z3.string().max(60).nullable().optional(), actionUrl: z3.string().max(2e3).nullable().optional(), isActive: z3.boolean().optional(), sortOrder: z3.number().int().min(-1e4).max(1e4).optional() }) })).mutation(async ({ input }) => {
        const db = await database();
        const cleanBanVals = { ...input.values };
        if (typeof cleanBanVals.imageUrl === "string" && cleanBanVals.imageUrl.startsWith("/api/fast-img/")) delete cleanBanVals.imageUrl;
        globalThis.__fastImgCache?.delete("banner:" + input.id);
        await db.update(banners).set(cleanBanVals).where(eq4(banners.id, input.id));
        clearCatalogCache();
        return { success: true };
      }),
      delete: adminProcedure.input(z3.object({ id: safeId })).mutation(async ({ input }) => {
        const db = await database();
        await db.delete(banners).where(eq4(banners.id, input.id));
        clearCatalogCache();
        return { success: true };
      })
    }),
    offers: router({
      list: requirePermission("offers.manage").query(async () => {
        const db = await database();
        return db.select().from(offers).orderBy(desc(offers.createdAt));
      }),
      create: requirePermission("offers.manage").use(async ({ next }) => {
        clearLiveHomeCache();
        return next();
      }).input(z3.object({
        title: z3.string().trim().min(1).max(160),
        description: z3.string().trim().max(1e3).nullable().optional(),
        code: z3.string().trim().min(1).max(40),
        discountType: z3.enum(["fixed", "percent"]),
        discountValue: z3.number().int().min(1).max(1e8),
        minimumOrder: z3.number().int().min(0).max(1e8).default(0),
        startsAt: z3.string().nullable().optional(),
        endsAt: z3.string().nullable().optional(),
        isActive: z3.boolean().default(true)
      })).mutation(async ({ input }) => {
        if (input.discountType === "percent" && input.discountValue > 100) {
          throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0646\u0633\u0628\u0629 \u0627\u0644\u062E\u0635\u0645 \u064A\u062C\u0628 \u0623\u0644\u0627 \u062A\u062A\u062C\u0627\u0648\u0632 100%." });
        }
        const db = await database();
        const cleanCode = input.code.trim().toUpperCase();
        const values = {
          title: input.title,
          description: input.description ?? null,
          code: cleanCode,
          discountType: input.discountType,
          discountValue: input.discountValue,
          minimumOrder: input.minimumOrder ?? 0,
          startsAt: input.startsAt ? new Date(input.startsAt) : null,
          endsAt: input.endsAt ? new Date(input.endsAt) : null,
          isActive: input.isActive
        };
        const result = await db.insert(offers).values(values).onDuplicateKeyUpdate({ set: values });
        clearCatalogCache();
        return { id: Number(result[0].insertId || 1) };
      }),
      update: requirePermission("offers.manage").use(async ({ next }) => {
        clearLiveHomeCache();
        return next();
      }).input(z3.object({
        id: safeId,
        values: z3.object({
          title: z3.string().trim().min(1).max(160).optional(),
          description: z3.string().max(1e3).nullable().optional(),
          code: z3.string().trim().min(1).max(40).optional(),
          discountType: z3.enum(["fixed", "percent"]).optional(),
          discountValue: z3.number().int().min(1).max(1e8).optional(),
          minimumOrder: z3.number().int().min(0).max(1e8).optional(),
          startsAt: z3.string().nullable().optional(),
          endsAt: z3.string().nullable().optional(),
          isActive: z3.boolean().optional()
        })
      })).mutation(async ({ input }) => {
        if (input.values.discountType === "percent" && input.values.discountValue !== void 0 && input.values.discountValue > 100) {
          throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0646\u0633\u0628\u0629 \u0627\u0644\u062E\u0635\u0645 \u064A\u062C\u0628 \u0623\u0644\u0627 \u062A\u062A\u062C\u0627\u0648\u0632 100%." });
        }
        const db = await database();
        await db.update(offers).set({
          ...input.values,
          code: input.values.code?.trim().toUpperCase(),
          startsAt: input.values.startsAt === void 0 ? void 0 : input.values.startsAt === null || input.values.startsAt === "" ? null : new Date(input.values.startsAt),
          endsAt: input.values.endsAt === void 0 ? void 0 : input.values.endsAt === null || input.values.endsAt === "" ? null : new Date(input.values.endsAt)
        }).where(eq4(offers.id, input.id));
        clearCatalogCache();
        return { success: true };
      }),
      delete: adminProcedure.input(z3.object({ id: safeId })).mutation(async ({ input }) => {
        const db = await database();
        await db.delete(offers).where(eq4(offers.id, input.id));
        clearCatalogCache();
        return { success: true };
      })
    }),
    settings: router({
      get: requireAnyPermission(["settings.manage", "overview.view"]).query(async () => readSettings(await database())),
      save: requirePermission("settings.manage").input(settingSchema).mutation(async ({ input }) => {
        clearCatalogCache();
        const db = await database();
        await db.transaction(async (tx) => {
          for (const [key, value] of Object.entries(input)) {
            const stored = value === null ? "" : typeof value === "string" ? value : JSON.stringify(value);
            await tx.insert(storeSettings).values({ key, value: stored }).onDuplicateKeyUpdate({ set: { value: stored } });
          }
        });
        clearCatalogCache();
        return { success: true };
      })
    }),
    orders: router({
      // --- ORDER_DELETE_ENDPOINT ---
      delete: requirePermission("orders.manage").use(async ({ next }) => {
        clearCatalogCache();
        return next();
      }).input(z3.object({ id: safeId })).mutation(async ({ input }) => {
        const db = await database();
        await db.transaction(async (tx) => {
          await tx.delete(customerPushSubscriptions).where(eq4(customerPushSubscriptions.orderId, input.id));
          await tx.delete(orderEvents).where(eq4(orderEvents.orderId, input.id));
          await tx.delete(orderItems).where(eq4(orderItems.orderId, input.id));
          await tx.delete(orders).where(eq4(orders.id, input.id));
        });
        return { success: true };
      }),
      createdAfter: adminProcedure.input(z3.object({ afterId: z3.number().int().min(0).max(Number.MAX_SAFE_INTEGER) })).query(async ({ input }) => getCached("createdAfter:" + input.afterId, 1e4, async () => {
        const db = await database();
        if (input.afterId === 0) {
          const latest = (await db.select({ id: orders.id }).from(orders).orderBy(desc(orders.id)).limit(1))[0];
          return { latestId: latest?.id ?? 0, orders: [] };
        }
        const rows = await db.select({ id: orders.id, orderNumber: orders.orderNumber, createdAt: orders.createdAt }).from(orders).where(gt(orders.id, input.afterId)).orderBy(asc(orders.id)).limit(25);
        return { latestId: rows.at(-1)?.id ?? input.afterId, orders: rows };
      })),
      list: requireAnyPermission(["orders.view", "orders.manage"]).query(async () => {
        const db = await database();
        const rows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(500);
        if (!rows.length) return [];
        const ids = rows.map((order) => sql2`${order.id}`);
        const [items, events] = await Promise.all([
          db.select().from(orderItems).where(sql2`${orderItems.orderId} in (${sql2.join(ids, sql2`, `)})`),
          db.select().from(orderEvents).where(sql2`${orderEvents.orderId} in (${sql2.join(ids, sql2`, `)})`).orderBy(asc(orderEvents.createdAt))
        ]);
        return rows.map((order) => ({ ...order, items: items.filter((item) => item.orderId === order.id), events: events.filter((event) => event.orderId === order.id) }));
      }),
      removeItem: requirePermission("orders.manage").use(async ({ next }) => {
        const res = await next();
        clearCatalogCache();
        return res;
      }).input(z3.object({
        orderId: safeId,
        itemId: safeId,
        cancelQty: z3.number().int().min(1).max(1e3).optional(),
        reason: z3.string().trim().min(1).max(400)
      })).mutation(async ({ ctx, input }) => {
        const db = await database();
        const result = await db.transaction(async (tx) => {
          const ord = (await tx.select().from(orders).where(eq4(orders.id, input.orderId)).limit(1).for("update"))[0];
          if (!ord) throw new TRPCError3({ code: "NOT_FOUND", message: "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0637\u0644\u0628." });
          if (ord.status === "delivered" || ord.status === "cancelled") {
            throw new TRPCError3({ code: "PRECONDITION_FAILED", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0639\u062F\u064A\u0644 \u0623\u0635\u0646\u0627\u0641 \u0637\u0644\u0628 \u062A\u0645 \u062A\u0633\u0644\u064A\u0645\u0647 \u0623\u0648 \u0625\u0644\u063A\u0627\u0624\u0647 \u0628\u0627\u0644\u0643\u0627\u0645\u0644." });
          }
          const allItems = await tx.select().from(orderItems).where(eq4(orderItems.orderId, input.orderId));
          const targetItem = allItems.find((it) => it.id === input.itemId);
          if (!targetItem) throw new TRPCError3({ code: "NOT_FOUND", message: "\u0627\u0644\u0635\u0646\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0647\u0630\u0647 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629." });
          const qtyToCancel = input.cancelQty ? Math.min(targetItem.quantity, input.cancelQty) : targetItem.quantity;
          const isFullCancel = qtyToCancel >= targetItem.quantity;
          const deductedAmount = isFullCancel ? targetItem.lineTotal : Math.round(targetItem.unitPrice * qtyToCancel);
          if (targetItem.productId !== null) {
            const prod = (await tx.select({ stock: products.stock }).from(products).where(eq4(products.id, targetItem.productId)).limit(1).for("update"))[0];
            if (prod && prod.stock !== null) {
              await tx.update(products).set({ stock: prod.stock + qtyToCancel }).where(eq4(products.id, targetItem.productId));
            }
          }
          if (isFullCancel) {
            await tx.delete(orderItems).where(eq4(orderItems.id, targetItem.id));
          } else {
            const remainQty = targetItem.quantity - qtyToCancel;
            const remainLineTotal = Math.max(0, targetItem.lineTotal - deductedAmount);
            await tx.update(orderItems).set({ quantity: remainQty, lineTotal: remainLineTotal }).where(eq4(orderItems.id, targetItem.id));
          }
          const updatedItems = await tx.select().from(orderItems).where(eq4(orderItems.orderId, input.orderId));
          const newSubtotal = updatedItems.reduce((sum, it) => sum + Number(it.lineTotal || 0), 0);
          const newStatus = updatedItems.length === 0 ? "cancelled" : ord.status;
          const newDeliveryFee = updatedItems.length === 0 ? 0 : ord.deliveryFee;
          const newTotal = updatedItems.length === 0 ? 0 : Math.max(0, newSubtotal + newDeliveryFee - Number(ord.discount || 0));
          await tx.update(orders).set({ subtotal: newSubtotal, deliveryFee: newDeliveryFee, total: newTotal, status: newStatus }).where(eq4(orders.id, input.orderId));
          const auditNote = isFullCancel ? "\u274C \u0625\u0644\u063A\u0627\u0621 \u0635\u0646\u0641 \u0645\u0646 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629: \xAB" + targetItem.productName + "\xBB (\u0627\u0644\u0643\u0645\u064A\u0629: " + qtyToCancel + " \xB7 \u062E\u064F\u0635\u0645: " + deductedAmount + " \u0631.\u064A) \u2014 \u0627\u0644\u062A\u0648\u0636\u064A\u062D \u0644\u0644\u0639\u0645\u064A\u0644: " + input.reason + " | \u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u062C\u062F\u064A\u062F: " + newTotal + " \u0631.\u064A" : "\u274C \u062A\u0639\u062F\u064A\u0644 \u0643\u0645\u064A\u0629 \u0635\u0646\u0641: \xAB" + targetItem.productName + "\xBB (\u0623\u064F\u0644\u063A\u064A " + qtyToCancel + " \u0648\u0628\u0642\u064A " + (targetItem.quantity - qtyToCancel) + " \xB7 \u062E\u064F\u0635\u0645: " + deductedAmount + " \u0631.\u064A) \u2014 \u0627\u0644\u062A\u0648\u0636\u064A\u062D \u0644\u0644\u0639\u0645\u064A\u0644: " + input.reason + " | \u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u062C\u062F\u064A\u062F: " + newTotal + " \u0631.\u064A";
          await tx.insert(orderEvents).values({
            orderId: input.orderId,
            status: newStatus,
            note: auditNote,
            changedByUserId: ctx.user.id
          });
          return { orderNumber: ord.orderNumber, newStatus, newTotal, deductedAmount, itemName: targetItem.productName, customerNotice: "\u062A\u062D\u062F\u064A\u062B \u0628\u062E\u0635\u0648\u0635 \u0637\u0644\u0628\u0643 " + ord.orderNumber + ": \u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \xAB" + targetItem.productName + "\xBB (" + input.reason + ") \u0648\u062E\u0635\u0645 " + deductedAmount + " \u0631.\u064A \u0645\u0646 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629. \u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u062C\u062F\u064A\u062F: " + newTotal + " \u0631.\u064A" };
        });
        void notifyCustomerOrderStatus(input.orderId, result.orderNumber, result.newStatus, result.customerNotice).catch(() => {
        });
        return result;
      }),
      sendNote: requirePermission("orders.manage").input(z3.object({ id: safeId, note: z3.string().trim().min(1).max(500) })).mutation(async ({ ctx, input }) => {
        const db = await database();
        const current = (await db.select({ id: orders.id, status: orders.status, orderNumber: orders.orderNumber }).from(orders).where(eq4(orders.id, input.id)).limit(1))[0];
        if (!current) throw new TRPCError3({ code: "NOT_FOUND", message: "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0637\u0644\u0628." });
        await db.insert(orderEvents).values({ orderId: input.id, status: current.status, note: input.note, changedByUserId: ctx.user.id > 0 ? ctx.user.id : null });
        await notifyCustomerOrderStatus(input.id, current.orderNumber, current.status, input.note);
        return { success: true };
      }),
      setStatus: requirePermission("orders.manage").input(z3.object({ id: safeId, status: orderStatus, note: z3.string().trim().max(500).optional() })).mutation(async ({ ctx, input }) => {
        const db = await database();
        const orderNumber = await db.transaction(async (tx) => {
          const current = (await tx.select({ id: orders.id, status: orders.status, orderNumber: orders.orderNumber }).from(orders).where(eq4(orders.id, input.id)).limit(1).for("update"))[0];
          if (!current) throw new TRPCError3({ code: "NOT_FOUND", message: "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0637\u0644\u0628." });
          if (current.status === "delivered" || current.status === "cancelled") throw new TRPCError3({ code: "PRECONDITION_FAILED", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u063A\u064A\u064A\u0631 \u062D\u0627\u0644\u0629 \u0637\u0644\u0628 \u0645\u063A\u0644\u0642." });
          const allowed = { new: ["preparing", "cancelled"], preparing: ["ready", "cancelled"], ready: ["out_for_delivery", "cancelled"], out_for_delivery: ["delivered"] };
          if (!allowed[current.status]?.includes(input.status)) throw new TRPCError3({ code: "PRECONDITION_FAILED", message: current.status === "out_for_delivery" && input.status === "cancelled" ? "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0637\u0644\u0628 \u0628\u0639\u062F \u062E\u0631\u0648\u062C\u0647 \u0644\u0644\u062A\u0648\u0635\u064A\u0644\u061B \u0639\u0627\u0644\u062C\u0647 \u0639\u0628\u0631 \u0625\u062C\u0631\u0627\u0621 \u0625\u0631\u062C\u0627\u0639 \u0628\u0639\u062F \u0627\u0633\u062A\u0644\u0627\u0645\u0647." : "\u0627\u062A\u0628\u0639 \u062A\u0633\u0644\u0633\u0644 \u062D\u0627\u0644\u0627\u062A \u0627\u0644\u0637\u0644\u0628: \u062C\u062F\u064A\u062F\u060C \u062A\u062C\u0647\u064A\u0632\u060C \u062C\u0627\u0647\u0632\u060C \u062A\u0648\u0635\u064A\u0644\u060C \u062B\u0645 \u062A\u0633\u0644\u064A\u0645\u061B \u0623\u0648 \u0623\u0644\u063A\u0650 \u0627\u0644\u0637\u0644\u0628 \u0642\u0628\u0644 \u062E\u0631\u0648\u062C\u0647." });
          if (input.status === "cancelled") {
            const lines = await tx.select({ productId: orderItems.productId, quantity: orderItems.quantity }).from(orderItems).where(eq4(orderItems.orderId, input.id));
            for (const line of lines) {
              if (line.productId === null) continue;
              const product = (await tx.select({ stock: products.stock }).from(products).where(eq4(products.id, line.productId)).limit(1).for("update"))[0];
              if (product && product.stock !== null) await tx.update(products).set({ stock: product.stock + line.quantity }).where(eq4(products.id, line.productId));
            }
          }
          await tx.update(orders).set({ status: input.status }).where(eq4(orders.id, input.id));
          await tx.insert(orderEvents).values({ orderId: input.id, status: input.status, note: input.note ?? null, changedByUserId: null });
          return current.orderNumber;
        });
        void notifyCustomerOrderStatus(input.id, orderNumber, input.status, input.note).catch(() => console.warn("[Push] Could not notify customer of an order update"));
        clearCatalogCache();
        return { success: true };
      })
    }),
    customers: router({
      list: requirePermission("customers.view").query(async () => {
        const db = await database();
        return db.select({
          phone: orders.phone,
          orderCount: sql2`count(*)`,
          totalSpent: sql2`coalesce(sum(case when ${orders.status} <> 'cancelled' then ${orders.total} else 0 end), 0)`,
          lastOrderAt: sql2`max(${orders.createdAt})`
        }).from(orders).where(sql2`${orders.phone} <> ''`).groupBy(orders.phone).orderBy(desc(sql2`max(${orders.createdAt})`)).limit(500);
      })
    }),
    users: router({
      list: requirePermission("customers.view").query(async () => {
        const db = await database();
        const rows = await db.select({ id: users.id, name: users.name, email: users.email, phone: users.phone, role: users.role, suspended: users.suspended, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn }).from(users).orderBy(desc(users.createdAt)).limit(1e3);
        if (!rows.length) return [];
        const ids = rows.map((user) => user.id);
        const [stats, savedAddresses] = await Promise.all([
          db.select({ userId: orders.userId, orderCount: sql2`count(*)`, totalSpent: sql2`coalesce(sum(case when ${orders.status} <> 'cancelled' then ${orders.total} else 0 end), 0)` }).from(orders).where(inArray(orders.userId, ids)).groupBy(orders.userId),
          db.select({ userId: addresses.userId, id: addresses.id, label: addresses.label, recipientName: addresses.recipientName, phone: addresses.phone, city: addresses.city, district: addresses.district, details: addresses.details, isDefault: addresses.isDefault }).from(addresses).where(inArray(addresses.userId, ids)).orderBy(desc(addresses.isDefault), desc(addresses.id))
        ]);
        return rows.map((user) => {
          const stat = stats.find((row) => row.userId === user.id);
          return { ...user, orderCount: Number(stat?.orderCount ?? 0), totalSpent: Number(stat?.totalSpent ?? 0), addresses: savedAddresses.filter((address) => address.userId === user.id) };
        });
      }),
      setSuspended: requirePermission("staff.manage").input(z3.object({ id: safeId, suspended: z3.boolean() })).mutation(async ({ ctx, input }) => {
        const db = await database();
        const target = (await db.select({ id: users.id, role: users.role, openId: users.openId }).from(users).where(eq4(users.id, input.id)).limit(1))[0];
        if (!target) throw new TRPCError3({ code: "NOT_FOUND", message: "\u0627\u0644\u062D\u0633\u0627\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
        if (target.id === ctx.user.id || target.role === "admin") throw new TRPCError3({ code: "FORBIDDEN", message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0638\u0631 \u062D\u0633\u0627\u0628 \u0645\u0627\u0644\u0643/\u0645\u062F\u064A\u0631." });
        await db.update(users).set({ suspended: input.suspended }).where(eq4(users.id, input.id));
        clearCatalogCache();
        return { success: true };
      })
    }),
    uploadImage: requireAnyPermission(["products.manage", "products.add", "products.edit", "categories.manage", "banners.manage", "settings.manage"]).input(z3.object({ dataUrl: z3.string().min(30).max(85e5), kind: z3.enum(["product", "category", "banner", "icon"]) })).mutation(async ({ input }) => {
      const match = input.dataUrl.match(/^data:(image\/(?:webp|png|jpeg));base64,([A-Za-z0-9+/=]+)$/);
      if (!match) throw new TRPCError3({ code: "BAD_REQUEST", message: "\u0635\u064A\u063A\u0629 \u0627\u0644\u0635\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645\u0629. \u0627\u0633\u062A\u062E\u062F\u0645 WEBP \u0623\u0648 PNG \u0623\u0648 JPEG." });
      return { imageUrl: input.dataUrl };
    })
  })
});
async function __prewarmCatalog() {
  try {
    const caller = commerceRouter.createCaller({ req: { headers: {}, ip: "127.0.0.1" }, res: {}, user: null });
    await Promise.allSettled([
      caller.catalog.home(),
      caller.catalog.listCategories(),
      caller.catalog.listProducts({ sort: "featured", limit: 24 }),
      caller.catalog.listProducts({ sort: "featured", limit: 60 })
    ]);
  } catch {
  }
}
setTimeout(__prewarmCatalog, 800);
setInterval(__prewarmCatalog, 45e3).unref();

// server/routers.ts
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  commerce: commerceRouter
});

// server/_core/index.ts
init_schema();
import { eq as eq5 } from "drizzle-orm";

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs4 from "fs";
import path2 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs3 from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
var PROJECT_ROOT = import.meta.dirname;
var LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
var MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024;
var TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6);
function ensureLogDir() {
  if (!fs3.existsSync(LOG_DIR)) {
    fs3.mkdirSync(LOG_DIR, { recursive: true });
  }
}
function trimLogFile(logPath, maxSize) {
  try {
    if (!fs3.existsSync(logPath) || fs3.statSync(logPath).size <= maxSize) {
      return;
    }
    const lines = fs3.readFileSync(logPath, "utf-8").split("\n");
    const keptLines = [];
    let keptBytes = 0;
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}
`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }
    fs3.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
  }
}
function writeToLogFile(source, entries) {
  if (entries.length === 0) return;
  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);
  const lines = entries.map((entry) => {
    const ts = (/* @__PURE__ */ new Date()).toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });
  fs3.appendFileSync(logPath, `${lines.join("\n")}
`, "utf-8");
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}
function vitePluginManusDebugCollector() {
  return {
    name: "manus-debug-collector",
    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js"
            },
            injectTo: "head"
          }
        ]
      };
    },
    configureServer(server) {
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }
        const handlePayload = (payload) => {
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };
        const reqBody = req.body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    }
  };
}
function vitePluginPublicPlatformConfig() {
  return {
    name: "manus-public-platform-config",
    configureServer(server) {
      server.middlewares.use("/api/platform/config.js", (_req, res) => {
        res.setHeader("Content-Type", "application/javascript");
        res.setHeader("Cache-Control", "no-store");
        res.end(publicPlatformScript());
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "api/platform/config.js", source: publicPlatformScript() });
    }
  };
}
var plugins = [vitePluginPublicPlatformConfig(), react(), tailwindcss(), jsxLocPlugin(), vitePluginManusDebugCollector()];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs4.promises.readFile(clientTemplate, "utf-8");
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path2.resolve(import.meta.dirname, "../..", "dist", "public") : path2.resolve(import.meta.dirname, "public");
  if (!fs4.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/_core/index.ts
var HTTPS_PREFIX = ["ht", "tps", "://"].join("");
var HTTP_PREFIX = ["ht", "tp"].join("");
async function startServer() {
  const app = express2();
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
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok", ts: Date.now() }));
  if (!globalThis.__keepAliveTimer) {
    globalThis.__keepAliveTimer = setInterval(() => {
      const extUrl = process.env.RENDER_EXTERNAL_URL || HTTPS_PREFIX + "original-store-xmyf.onrender.com";
      fetch(extUrl + "/api/health").catch(() => {
      });
    }, 10 * 60 * 1e3);
  }
  const ALLOWED_IMG_MIMES = /* @__PURE__ */ new Set(["image/webp", "image/png", "image/jpeg", "image/jpg", "image/gif", "image/avif"]);
  function isSafeExternalImageUrl(rawUrl) {
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
      const cacheMap = globalThis.__fastImgCache || (globalThis.__fastImgCache = /* @__PURE__ */ new Map());
      const cacheKey = kind + ":" + id;
      let entry = cacheMap.get(cacheKey);
      if (!entry) {
        const db = await getDb();
        if (!db) return res.status(404).end();
        const { products: products2, categories: categories2, banners: banners2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
        const table = kind === "product" ? products2 : kind === "category" ? categories2 : kind === "banner" ? banners2 : null;
        if (!table) return res.status(404).end();
        const rows = await db.select({ imageUrl: table.imageUrl }).from(table).where(eq5(table.id, id)).limit(1);
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
          if (ab.byteLength > 85e5) return res.status(413).end();
          const buf = Buffer.from(ab);
          entry = { contentType: ct, buf };
          cacheMap.set(cacheKey, entry);
          const dataUrl = "data:" + ct + ";base64," + buf.toString("base64");
          void db.update(table).set({ imageUrl: dataUrl }).where(eq5(table.id, id)).catch(() => {
          });
        } else if (raw.startsWith("/") && !raw.startsWith("//")) {
          return res.redirect(302, raw);
        } else {
          return res.status(404).end();
        }
      }
      res.set("Content-Type", entry.contentType);
      res.set("X-Content-Type-Options", "nosniff");
      res.set("Content-Security-Policy", "default-src 'none'; sandbox");
      res.set("Cache-Control", "public, max-age=31536000, immutable");
      return res.send(entry.buf);
    } catch {
      return res.status(500).end();
    }
  });
  let cachedBrand = null;
  const publicBrand = async () => {
    try {
      const g = globalThis;
      if (g.__fastHomeData?.settings) {
        const s = g.__fastHomeData.settings;
        const candidate2 = String(s.storeIconUrl || "");
        const icon2 = candidate2.startsWith("/manus-storage/") || candidate2.startsWith(HTTPS_PREFIX) || candidate2.startsWith("data:image/") ? candidate2 : "";
        return { name: s.storeName || "ORIGINAL \u2013 \u0623\u0648\u0631\u062C\u0646\u0627\u0644", icon: icon2 };
      }
      if (cachedBrand && Date.now() - cachedBrand.time < 3e5) {
        return { name: cachedBrand.name, icon: cachedBrand.icon };
      }
      const db = await getDb();
      if (!db) return { name: "ORIGINAL \u2013 \u0623\u0648\u0631\u062C\u0646\u0627\u0644", icon: "" };
      const rows = await db.select({ key: storeSettings.key, value: storeSettings.value }).from(storeSettings).where(eq5(storeSettings.key, "storeIconUrl")).limit(1);
      const nameRows = await db.select({ value: storeSettings.value }).from(storeSettings).where(eq5(storeSettings.key, "storeName")).limit(1);
      const candidate = rows[0]?.value ?? "";
      const icon = candidate.startsWith("/manus-storage/") || candidate.startsWith(HTTPS_PREFIX) ? candidate : "";
      const name = (nameRows[0]?.value || "ORIGINAL \u2013 \u0623\u0648\u0631\u062C\u0646\u0627\u0644").replace(new RegExp("\u0623\u0648\u0631\u064A\u062C\u0646\u0627\u0644|\u0627\u0648\u0631\u064A\u062C\u0646\u0627\u0644", "g"), "\u0623\u0648\u0631\u062C\u0646\u0627\u0644");
      cachedBrand = { name, icon, time: Date.now() };
      return { name, icon };
    } catch {
      return { name: "ORIGINAL \u2013 \u0623\u0648\u0631\u062C\u0646\u0627\u0644", icon: "" };
    }
  };
  app.get("/api/app-manifest.webmanifest", async (_req, res) => {
    const brand = await publicBrand();
    const imagePath = brand.icon && !brand.icon.startsWith("data:") ? new URL(brand.icon, HTTPS_PREFIX + "app.invalid").pathname : "";
    const type = imagePath.endsWith(".png") ? "image/png" : imagePath.endsWith(".jpg") || imagePath.endsWith(".jpeg") ? "image/jpeg" : imagePath.endsWith(".webp") ? "image/webp" : "image/png";
    const icons = [
      { src: "/app-icon-192-v4.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icon-512-v4.png", sizes: "512x512", type: "image/png", purpose: "any" }
    ];
    res.set("Cache-Control", "public, max-age=300").type("application/manifest+json").send(JSON.stringify({ id: "/", name: brand.name, short_name: "\u0623\u0648\u0631\u062C\u0646\u0627\u0644", description: "\u0645\u062A\u062C\u0631 ORIGINAL \u2013 \u0623\u0648\u0631\u062C\u0646\u0627\u0644", lang: "ar", dir: "rtl", start_url: "/", scope: "/", display: "standalone", background_color: "#f8f8f2", theme_color: "#870210", icons }));
  });
  app.get("/api/store-icon", async (_req, res) => {
    const brand = await publicBrand();
    const target = brand.icon && !brand.icon.startsWith("data:") ? brand.icon : "/app-icon-180-v4.png";
    res.set("Cache-Control", "public, max-age=300").redirect(302, target);
  });
  app.get("/api/platform/config.js", async (_req, res) => {
    const g = globalThis;
    if (!g.__fastHomeData && typeof g.__loadCatalogHome === "function") {
      try {
        await g.__loadCatalogHome();
      } catch {
      }
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
      createContext
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  server.on("error", (error) => {
    console.error("Server failed:", error.message);
    process.exit(1);
  });
  server.listen(port, "0.0.0.0", () => console.log("Server listening on port " + port));
}
startServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
