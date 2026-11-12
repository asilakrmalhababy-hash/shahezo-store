
let __cachedLiveHomeData: any = null;
let __lastLiveHomeDataTime = 0;
function clearLiveHomeCache() {
  __cachedLiveHomeData = null;
  __lastLiveHomeDataTime = 0;
}

import fs from "node:fs";
import { createHash } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import { storagePut } from "./storage";
import { getDb, resetDbPool } from "./db";
import {
  addresses,
  banners,
  categories,
  customerPushSubscriptions,
  favorites,
  orderEvents,
  orderItems,
  orders,
  offers,
  ownerPushSubscriptions,
  productRecommendations,
  products,
  storeSettings,
  users,
} from "../drizzle/schema";
import { adminAuditLogs, adminStaff } from "../drizzle/schema";
import { adminProcedure, protectedProcedure, publicProcedure, requireAnyPermission, requirePermission, router } from "./_core/trpc";
import { PERMISSION_KEYS, PERMISSION_LABELS, ROLE_DEFINITIONS, ROLE_KEYS, canManageTargetStaff, hasPermission, parseAllowedCategoriesJson, parsePermissionsJson, serializePermissionsAndCategories, type AdminRoleKey, type PermissionKey } from "@shared/rbac";
import { ensureRbacTables, getClientIp, hashAdminPassword, verifyAdminPassword, writeAdminAuditLog } from "./_core/adminAuth";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { analyzeProductImageAI, parseBulkProductsTextAI } from "./_core/llm";
import { invokeLLM } from "./_core/llm";
import { hashGuestOrderKey, isValidGuestPhone, matchesGuestOrderKey, normalizeYemeniPhone } from "./guest-orders";
import {
  getWebPushPublicKey,
  isAllowedPushEndpoint,
  protectPushSubscription,
  sendWebPush,
  unprotectPushSubscription,
  type PushMessage,
} from "./_core/webPush";
import {
  assistantResponseJsonSchema,
  parseAssistantModelContent,
  prepareAssistantResponse,
  type AssistantCatalogProduct,
  type AssistantModelOutput,
} from "./assistant";

async function database() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "قاعدة البيانات غير متاحة مؤقتًا." });
  return db;
}

const CACHE_FILE = ".catalog-cache.json";
const __catalogCache = new Map<string, { exp: number; data: any; refreshing?: boolean }>();
try {
  if (fs.existsSync(CACHE_FILE)) {
    const raw = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"), (k, val) =>
      (k === "createdAt" || k === "updatedAt" || k === "startsAt" || k === "endsAt" || k === "lastOrderAt" || k === "lastSignedIn") && typeof val === "string" ? new Date(val) : val
    );
    for (const [k, v] of Object.entries(raw)) __catalogCache.set(k, { exp: 0, data: v, refreshing: false });
  }
} catch {}
function saveDiskCache() {
  try {
    const obj: Record<string, any> = {};
    for (const [k, v] of __catalogCache.entries()) obj[k] = v.data;
    fs.writeFileSync(CACHE_FILE, JSON.stringify(obj));
  } catch {}
}
async function withFastRetry<T>(fetcher: () => Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      fetcher(),
      new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error("QUERY_TIMEOUT")), 5500); }),
    ]);
  } catch (err) {
    resetDbPool();
    return await fetcher();
  } finally {
    if (timer) clearTimeout(timer);
  }
}
function getCached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = __catalogCache.get(key);
  if (hit) {
    if (hit.exp <= now && !hit.refreshing) {
      hit.refreshing = true;
      withFastRetry(fetcher)
        .then(data => {
          __catalogCache.set(key, { exp: Date.now() + ttlMs, data, refreshing: false });
          saveDiskCache();
        })
        .catch(() => { hit.refreshing = false; });
    }
    return Promise.resolve(hit.data as T);
  }
  return withFastRetry(fetcher).then(data => {
    __catalogCache.set(key, { exp: Date.now() + ttlMs, data, refreshing: false });
    saveDiskCache();
    return data;
  });
}
function clearCatalogCache(removedProductId?: number) {
  __cachedLiveHomeData = null;
  __lastLiveHomeDataTime = 0;
  try {
    const g = globalThis as any;
    if (removedProductId && g.__fastHomeData && Array.isArray(g.__fastHomeData.products)) {
      g.__fastHomeData.products = g.__fastHomeData.products.filter((p: any) => p.id !== removedProductId);
    }
    g.__fastHomeData = null;
    g.__fastHomeTime = 0;
    g.__catalogVer = Date.now();
    if (typeof g.__resetRefreshingPromise === "function") g.__resetRefreshingPromise();
    if (typeof g.__loadCatalogHome === "function") { setTimeout(() => { void g.__loadCatalogHome().catch(() => {}); }, 5); }
  } catch {}
}


const AI_PRODUCT_CACHE_FILE = ".ai-product-recipes.json";
let __aiProductRecipes: Record<string, AssistantModelOutput> = {};
try {
  if (fs.existsSync(AI_PRODUCT_CACHE_FILE)) {
    __aiProductRecipes = JSON.parse(fs.readFileSync(AI_PRODUCT_CACHE_FILE, "utf8"));
  }
} catch {}

function saveAiProductRecipe(cacheKey: string, output: AssistantModelOutput) {
  const key = cacheKey.trim().toLowerCase();
  __aiProductRecipes[key] = output;
  try {
    fs.writeFileSync(AI_PRODUCT_CACHE_FILE, JSON.stringify(__aiProductRecipes, null, 2));
  } catch {}
}

async function generateAndCacheProductAiRecipe(
  productName: string,
  catalog: AssistantCatalogProduct[],
  customModification?: string,
): Promise<AssistantModelOutput | null> {
  const cacheKey = customModification
    ? `${productName.trim().toLowerCase()}::${customModification.trim().toLowerCase()}`
    : `${productName.trim().toLowerCase()}::init-v3`;

  if (__aiProductRecipes[cacheKey]) return __aiProductRecipes[cacheKey];

  const compactCatalog = catalog.slice(0, 50).map(p => ({ id: p.id, name: p.name, price: p.price, unit: p.unit }));
  const sys = "أنت المساعد والشيف الذكي لبوفية ومطعم «شهيزو – SHAHEZO» في اليمن (شهي ولذيذ · شاورما • فلافل • عصائر). تحدث بلهجة يمنية راقية وودودة، وقدم وصفاً شهياً للمنتج واقترح إضافات أو عصائر طبيعية مناسبة معه من قائمة شهيزو، ثم اعرض في النهاية اقتراحات تفاعلية في حقل suggestedQuestions.";
  const usr = [
    `الصنف الأساسي: «${productName}»`,
    customModification ? `طلب التعديل الخاص من الزبون: ${customModification}` : "المطلوب: تحليل ذكي للمنتج ومعلومات عنه مع اقتراحات تفاعلية.",
    `كتالوج المتجر الحالي: ${JSON.stringify(compactCatalog)}`,
  ].join("\n\n");

  const res = await invokeLLM({
    messages: [
      { role: "system", content: sys },
      { role: "user", content: usr },
    ],
    response_format: { type: "json_object" },
  });

  const parsed = parseAssistantModelContent(res.choices?.[0]?.message?.content);
  if (parsed && parsed.message) {
    saveAiProductRecipe(cacheKey, parsed);
    return parsed;
  }
  return null;
}

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(20).max(200).regex(/^[A-Za-z0-9_+/=-]+$/),
    auth: z.string().min(10).max(100).regex(/^[A-Za-z0-9_+/=-]+$/),
  }),
});

const ADMIN_PUSH_BACKUP_KEY = "admin_push_subscriptions_v2";

async function loadBackupAdminSubscriptions(db: any): Promise<Array<{ endpointHash: string; encryptedPayload: string }>> {
  try {
    const rows = await db.select().from(storeSettings).where(eq(storeSettings.key, ADMIN_PUSH_BACKUP_KEY)).limit(1);
    const parsed = JSON.parse(rows[0]?.value || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x: any) => x && typeof x.endpointHash === "string" && typeof x.encryptedPayload === "string");
  } catch {
    return [];
  }
}

async function saveBackupAdminSubscription(db: any, sub: { endpointHash: string; encryptedPayload: string }) {
  try {
    const existing = await loadBackupAdminSubscriptions(db);
    const filtered = existing.filter(x => x.endpointHash !== sub.endpointHash);
    filtered.unshift({ endpointHash: sub.endpointHash, encryptedPayload: sub.encryptedPayload });
    const nextVal = JSON.stringify(filtered.slice(0, 30));
    await db.insert(storeSettings).values({ key: ADMIN_PUSH_BACKUP_KEY, value: nextVal })
      .onDuplicateKeyUpdate({ set: { value: nextVal } });
  } catch {}
}

async function removeBackupAdminSubscription(db: any, endpointHash: string) {
  try {
    const existing = await loadBackupAdminSubscriptions(db);
    const filtered = existing.filter(x => x.endpointHash !== endpointHash);
    if (filtered.length === existing.length) return;
    const nextVal = JSON.stringify(filtered);
    await db.insert(storeSettings).values({ key: ADMIN_PUSH_BACKUP_KEY, value: nextVal })
      .onDuplicateKeyUpdate({ set: { value: nextVal } });
  } catch {}
}

async function deliverPushRows(
  rows: Array<{ id: number; endpointHash?: string; encryptedPayload: string }>,
  message: PushMessage,
  remove: (id: number, endpointHash?: string) => Promise<void>,
) {
  await Promise.allSettled(rows.map(async row => {
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
      const statusCode = error && typeof error === "object" && "statusCode" in error
        ? Number(error.statusCode)
        : undefined;
      if (statusCode === 404 || statusCode === 410) await remove(row.id, row.endpointHash);
      console.warn("[Push] Delivery failed", statusCode ?? "network");
    }
  }));
}

async function getAllAdminPushTargets(db: any) {
  const dbRows = await db.select({
    id: ownerPushSubscriptions.id,
    endpointHash: ownerPushSubscriptions.endpointHash,
    encryptedPayload: ownerPushSubscriptions.encryptedPayload,
  }).from(ownerPushSubscriptions).catch(() => []);
  const backupRows = await loadBackupAdminSubscriptions(db);
  const map = new Map<string, { id: number; endpointHash: string; encryptedPayload: string }>();
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

const __recentAdminPushLocks = new Map<string, number>();
async function notifyOwnerNewOrder(orderId: number, orderNumber: string, total: number, recipientName?: string, area?: string) {
  const lockKey = "admin-order-" + orderId;
  const now = Date.now();
  if (__recentAdminPushLocks.has(lockKey) && now - (__recentAdminPushLocks.get(lockKey) || 0) < 8000) return;
  __recentAdminPushLocks.set(lockKey, now);
  const db = await database();
  const targets = await getAllAdminPushTargets(db);
  if (!targets.length) return;
  const shortNo = orderNumber.split("-").pop() || orderNumber;
  const who = recipientName ? ("العميل: " + recipientName + (area ? " (" + area + ")" : "") + " · ") : "";
  await deliverPushRows(targets, {
    title: "🛍️ طلب جديد #" + shortNo + " · " + total.toLocaleString("en-US") + " ر.ي",
    body: who + "اضغط لفتح الطلب وتجهيزه الآن",
    url: "/admin/orders?order=" + encodeURIComponent(orderNumber),
    tag: "shahezo-admin-order-" + orderId,
  }, async (id, endpointHash) => {
    if (id > 0) await db.delete(ownerPushSubscriptions).where(eq(ownerPushSubscriptions.id, id)).catch(() => {});
    if (endpointHash) await removeBackupAdminSubscription(db, endpointHash);
  });
}

const __recentOrderPushLocks = new Map<string, number>();
async function notifyCustomerOrderStatus(orderId: number, orderNumber: string, status: string, note?: string) {
  const cleanNote = (note || "").trim();
  const lockKey = "cust-order-" + orderId + "::" + status + "::" + cleanNote;
  const now = Date.now();
  if (__recentOrderPushLocks.has(lockKey) && now - (__recentOrderPushLocks.get(lockKey) || 0) < 5000) {
    return;
  }
  __recentOrderPushLocks.set(lockKey, now);
  const db = await database();
  const subscriptions = await db.select({
    id: customerPushSubscriptions.id,
    endpointHash: customerPushSubscriptions.endpointHash,
    encryptedPayload: customerPushSubscriptions.encryptedPayload,
  }).from(customerPushSubscriptions).where(eq(customerPushSubscriptions.orderId, orderId));
  const uniqueByEndpoint = [...new Map(subscriptions.map(s => [s.endpointHash, s])).values()];
  if (!uniqueByEndpoint.length) return;
  const shortNo = orderNumber.split("-").pop() || orderNumber;
  const defaultBodies: Record<string, string> = {
    new: "تم استلام طلبك بنجاح وبانتظار التجهيز ✨",
    preparing: "طلبك الآن قيد التجهيز بعناية 👨‍🍳",
    ready: "طلبك جاهز للتوصيل الكامل 📦",
    out_for_delivery: "طلبك خرج للتوصيل وهو في طريقه إليك 🛵",
    delivered: "تم تسليم طلبك بنجاح، بالهناء والشفاء من بوفية شهيزو 🥙❤️",
    cancelled: "عذراً، تم إلغاء الطلب #" + shortNo,
  };
  const title = "🥙 بوفية شهيزو · طلب #" + shortNo;
  const body = cleanNote ? cleanNote.slice(0, 240) : (defaultBodies[status] || "تم تحديث حالة طلبك");
  await deliverPushRows(uniqueByEndpoint, {
    title,
    body,
    url: "/orders?order=" + encodeURIComponent(orderNumber),
    tag: "shahezo-customer-order-" + orderId,
  }, async id => { await db.delete(customerPushSubscriptions).where(eq(customerPushSubscriptions.id, id)).catch(() => {}); });
}

const orderStatus = z.enum(["new", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"]);
const safeId = z.number().int().positive();
const settingSchema = z.object({
  storeName: z.string().trim().max(100).optional(),
  storeDescription: z.string().trim().max(500).optional(),
  contactPhone: z.string().trim().max(32).optional(),
  currency: z.string().trim().max(20).optional(),
  storeIconUrl: z.string().max(8500000).nullable().optional(),
  deliveryEnabled: z.boolean().optional(),
  deliveryFee: z.number().int().min(0).max(100000000).nullable().optional(),
  minOrderAmount: z.number().int().min(0).max(100000000).nullable().optional(),
  deliveryZones: z.array(z.object({ name: z.string().trim().min(1).max(100), fee: z.number().int().min(0).max(100000000), enabled: z.boolean() })).max(100).optional(),
  orderPaused: z.boolean().optional(),
  pausedMessage: z.string().trim().max(300).optional(),
  rewardsThreshold: z.number().int().min(0).max(100000000).nullable().optional(),
  rewardsMessage: z.string().trim().max(2000).optional(),
  rewardEnabled: z.boolean().optional(),
  rewardType: z.enum(["free_delivery", "discount_percent"]).optional(),
  rewardValue: z.number().int().min(0).max(100).optional(),
  aiInstructions: z.string().trim().max(3000).optional(),
  deliveryTreeConfig: z.string().max(600000).optional(),
});

function slugify(value: string) {
  const slug = value.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 160);
  return `${slug || "item"}-${nanoid(5).toLowerCase()}`;
}

const PUBLIC_STORE_SETTING_KEYS = new Set([
  "storeName", "storeDescription", "contactPhone", "currency", "storeIconUrl",
  "deliveryEnabled", "deliveryFee", "deliveryZones", "orderPaused", "pausedMessage",
  "rewardEnabled", "rewardsThreshold", "rewardType", "rewardValue", "rewardsMessage",
  "aiInstructions", "deliveryTreeConfig",
]);

const __orderRateBuckets = new Map<string, { count: number; resetAt: number }>();
function enforceOrderCreateRateLimit(ip: string) {
  const now = Date.now();
  const key = (ip || "unknown").slice(0, 80);
  const b = __orderRateBuckets.get(key);
  if (!b || now > b.resetAt) {
    __orderRateBuckets.set(key, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return;
  }
  if (b.count >= 6) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "تم إرسال عدة طلبات متتالية من هذا الجهاز. يرجى الانتظار قليلاً قبل إرسال طلب جديد." });
  }
  b.count += 1;
}

const __missingItemRateBuckets = new Map<string, { count: number; resetAt: number }>();
function canCreateMissingItemOrder(ip: string): boolean {
  const now = Date.now();
  const key = (ip || "unknown").slice(0, 80);
  const b = __missingItemRateBuckets.get(key);
  if (!b || now > b.resetAt) {
    __missingItemRateBuckets.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (b.count >= 2) return false;
  b.count += 1;
  return true;
}

async function readSettings(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  try {
    const rows = await db.select().from(storeSettings);
    const settings: Record<string, string> = { deliveryEnabled: "true", deliveryFee: "0" };
    for (const row of rows) {
      if (!PUBLIC_STORE_SETTING_KEYS.has(row.key)) continue;
      settings[row.key] = row.value;
    }
    const oldStoreNameNorm = new RegExp("أوريجنال|أورجنال|اوريجنال|ORIGINAL", "gi");
    if (!settings.storeName || oldStoreNameNorm.test(settings.storeName)) settings.storeName = "شهيزو – SHAHEZO";
    if (!settings.contactPhone) settings.contactPhone = "779542219";
    if (!settings.storeDescription) settings.storeDescription = "شهيزو – شهي ولذيذ · شاورما • فلافل • عصائر طبيعية طازجة | للطلب والاستفسار: 779542219 - 772206455";
    return settings;
  } catch (err) {
    console.warn("[Settings] Using fallback defaults:", err instanceof Error ? err.message : err);
    return { deliveryEnabled: "true", deliveryFee: "0" };
  }
}

const DEFAULT_SERVER_DELIVERY_TREE = {
  strictSelectionOnly: true,
  globalFreeAbove: null,
  vipFreePhones: [],
  cities: [
    {
      id: "city_sanaa", name: "صنعاء", defaultFee: 500, freeDeliveryPromo: false, promoBanner: "", enabled: true,
      areas: [
        { id: "area_maeen", name: "معين", defaultFee: 500, enabled: true, streets: [
          { id: "st_raqqas", name: "الرقاص", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 35 دقيقة", enabled: true },
          { id: "st_daeri", name: "الدائري", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 35 دقيقة", enabled: true },
          { id: "st_hael", name: "شارع هائل", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 35 دقيقة", enabled: true },
          { id: "st_sunaina", name: "السنينة", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 45 دقيقة", enabled: true },
          { id: "st_asr", name: "عصر", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 45 دقيقة", enabled: true },
          { id: "st_madhbah", name: "مذبح", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 45 دقيقة", enabled: true },
        ]},
        { id: "area_sabeen", name: "السبعين", defaultFee: 600, enabled: true, streets: [
          { id: "st_haddah", name: "حدة", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 40 دقيقة", enabled: true },
          { id: "st_asbahi", name: "الأصبحي", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 45 دقيقة", enabled: true },
          { id: "st_baitbaws", name: "بيت بوس", fee: 700, promoFee: null, promoLabel: "", freeAbove: null, etaText: "35 - 50 دقيقة", enabled: true },
          { id: "st_maqaleh", name: "شارع المقالح", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 45 دقيقة", enabled: true },
          { id: "st_shumaila", name: "شميلة", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 45 دقيقة", enabled: true },
        ]},
        { id: "area_wahdah", name: "الوحدة", defaultFee: 500, enabled: true, streets: [
          { id: "st_jazaer", name: "شارع الجزائر", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 35 دقيقة", enabled: true },
          { id: "st_baghdad", name: "شارع بغداد", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 35 دقيقة", enabled: true },
          { id: "st_siyasi", name: "الحي السياسي", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 35 دقيقة", enabled: true },
          { id: "st_tahrir", name: "التحرير", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 40 دقيقة", enabled: true },
        ]},
        { id: "area_shoub", name: "شعوب والثورة", defaultFee: 600, enabled: true, streets: [
          { id: "st_hasaba", name: "الحصبة", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 45 دقيقة", enabled: true },
          { id: "st_juraf", name: "الجراف", fee: 700, promoFee: null, promoLabel: "", freeAbove: null, etaText: "35 - 50 دقيقة", enabled: true },
          { id: "st_sawan", name: "سعوان", fee: 700, promoFee: null, promoLabel: "", freeAbove: null, etaText: "35 - 50 دقيقة", enabled: true },
          { id: "st_sheraton", name: "شيراتون", fee: 600, promoFee: null, promoLabel: "", freeAbove: null, etaText: "30 - 45 دقيقة", enabled: true },
        ]},
      ],
    },
    {
      id: "city_ibb", name: "إب", defaultFee: 500, freeDeliveryPromo: false, promoBanner: "", enabled: true,
      areas: [
        { id: "area_dhihar", name: "الظهار", defaultFee: 500, enabled: true, streets: [
          { id: "st_ibb_taiz", name: "شارع تعز", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 40 دقيقة", enabled: true },
          { id: "st_ibb_daeri", name: "الدائري", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 40 دقيقة", enabled: true },
          { id: "st_ibb_subul", name: "السبل", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 40 دقيقة", enabled: true },
        ]},
        { id: "area_mashanah", name: "المشنة", defaultFee: 500, enabled: true, streets: [
          { id: "st_ibb_odain", name: "شارع العدين", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 40 دقيقة", enabled: true },
          { id: "st_ibb_maayen", name: "المعاين", fee: 500, promoFee: null, promoLabel: "", freeAbove: null, etaText: "25 - 40 دقيقة", enabled: true },
        ]},
      ],
    },
  ],
};

function deliveryFeeForCity(
  settings: Record<string, string>,
  city: string,
  district?: string,
  phone?: string,
  subtotal = 0,
): number | null {
  if (settings.deliveryEnabled === "false") return null;
  const cleanCity = String(city || "").trim();
  const cleanDistrict = String(district || "").trim();
  const cleanPhone = normalizeYemeniPhone(String(phone || ""));

  let tree: any = DEFAULT_SERVER_DELIVERY_TREE;
  if (settings.deliveryTreeConfig) {
    try {
      const parsed = JSON.parse(settings.deliveryTreeConfig);
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.cities) && parsed.cities.length > 0) {
        tree = parsed;
      }
    } catch {}
  }

  if (tree && typeof tree === "object") {
    if (cleanPhone && Array.isArray(tree.vipFreePhones)) {
      const vip = tree.vipFreePhones.find((v: any) => v && v.enabled !== false && normalizeYemeniPhone(String(v.phone || "")) === cleanPhone);
      if (vip) {
        const minOrd = Number(vip.minOrder || 0);
        if (subtotal >= minOrd) return 0;
      }
    }
    if (tree.globalFreeAbove && Number(tree.globalFreeAbove) > 0 && subtotal >= Number(tree.globalFreeAbove)) {
      return 0;
    }
    const activeCities = Array.isArray(tree.cities) ? tree.cities.filter((c: any) => c && c.enabled !== false) : [];
    if (activeCities.length > 0) {
      const matchedCity = activeCities.find((c: any) => String(c.name || "").trim() === cleanCity);
      if (matchedCity) {
        if (matchedCity.freeDeliveryPromo) return 0;
        const activeAreas = Array.isArray(matchedCity.areas) ? matchedCity.areas.filter((a: any) => a && a.enabled !== false) : [];
        const parts = cleanDistrict.split(/\s*[—\-|/]+\s*/).map(s => s.trim()).filter(Boolean);
        const areaPart = parts[0] || "";
        const streetPart = parts.slice(1).join(" ") || parts[0] || "";
        for (const area of activeAreas) {
          const areaMatch = !areaPart || String(area.name || "").trim() === areaPart || cleanDistrict.includes(String(area.name || "").trim());
          if (!areaMatch) continue;
          const activeStreets = Array.isArray(area.streets) ? area.streets.filter((st: any) => st && st.enabled !== false) : [];
          const matchedStreet = activeStreets.find((st: any) => {
            const sName = String(st.name || "").trim();
            return sName === streetPart || sName === cleanDistrict || cleanDistrict.endsWith(sName);
          });
          if (matchedStreet) {
            if (matchedStreet.freeAbove && Number(matchedStreet.freeAbove) > 0 && subtotal >= Number(matchedStreet.freeAbove)) return 0;
            if (matchedStreet.promoFee !== null && matchedStreet.promoFee !== undefined && matchedStreet.promoFee !== "" && Number.isFinite(Number(matchedStreet.promoFee)) && Number(matchedStreet.promoFee) >= 0) {
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
      const zones = JSON.parse(settings.deliveryZones) as Array<{ name: string; fee: number; enabled: boolean }>;
      const zone = zones.find(item => item.enabled && item.name.trim().toLocaleLowerCase() === cleanCity.toLocaleLowerCase());
      if (zone && Number.isInteger(zone.fee) && zone.fee >= 0) return zone.fee;
    } catch {}
  }
  const baseFee = Number(settings.deliveryFee ?? "");
  return Number.isInteger(baseFee) && baseFee >= 0 ? baseFee : 500;
}

type RewardConfigMeta = {
  rewardMode: "custom_gift" | "free_delivery" | "discount_percent" | "discount_fixed";
  giftName: string;
  fixedDiscount: number;
  endsAt: string;
  audience: "all" | "new_customers" | "returning_customers" | "vip_customers" | "specific_phones";
  allowedPhones: string;
  placement: "everywhere" | "home_and_cart" | "cart_only";
};

function unpackServerRewardConfig(rawMsg?: string | null, fallbackType?: string): { cleanMessage: string; cfg: RewardConfigMeta } {
  const defaultCfg: RewardConfigMeta = {
    rewardMode: fallbackType === "discount_percent" ? "discount_percent" : "free_delivery",
    giftName: "",
    fixedDiscount: 0,
    endsAt: "",
    audience: "all",
    allowedPhones: "",
    placement: "everywhere",
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
        placement: ["everywhere", "home_and_cart", "cart_only"].includes(parsed.placement) ? parsed.placement : "everywhere",
      },
    };
  } catch {
    return { cleanMessage: raw.trim(), cfg: defaultCfg };
  }
}

function isRewardCurrentlyActive(settings: Record<string, string>, subtotal: number): { active: boolean; cfg: RewardConfigMeta; cleanMessage: string; threshold: number } {
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

function orderTotals(subtotal: number, deliveryFee: number, offer: typeof offers.$inferSelect | null, settings: Record<string, string>) {
  let discount = 0;
  if (offer) {
    if (subtotal < offer.minimumOrder) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "الحد الأدنى لهذا العرض " + offer.minimumOrder.toLocaleString("en-US") + " ر.ي." });
    discount = offer.discountType === "percent" ? Math.floor(subtotal * offer.discountValue / 100) : offer.discountValue;
    discount = Math.min(discount, subtotal);
  }
  let effectiveDeliveryFee = deliveryFee;
  const rewardCheck = isRewardCurrentlyActive(settings, subtotal);
  if (rewardCheck.active) {
    const mode = rewardCheck.cfg.rewardMode;
    if (mode === "free_delivery" || (settings.rewardType === "free_delivery" && mode !== "custom_gift" && mode !== "discount_percent" && mode !== "discount_fixed")) {
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

function unpackServerProductWeightCfg(rawDesc?: string | null): { enabled: boolean; minAmount: number } {
  const raw = String(rawDesc || "");
  const m = raw.match(/\[\[wcfg:(\{[\s\S]*?\})\]\]/);
  if (!m) return { enabled: false, minAmount: 100 };
  try {
    const parsed = JSON.parse(m[1]);
    return {
      enabled: Boolean(parsed.enabled),
      minAmount: Number.isFinite(Number(parsed.minAmount)) && Number(parsed.minAmount) > 0 ? Math.floor(Number(parsed.minAmount)) : 100,
    };
  } catch {
    return { enabled: false, minAmount: 100 };
  }
}

function formatServerWeightGrams(grams: number): string {
  if (grams === 125) return "125 جرام (ثمن كيلو)";
  if (grams === 250) return "250 جرام (ربع كيلو)";
  if (grams === 500) return "500 جرام (نصف كيلو)";
  if (grams === 1000) return "1 كيلو كامل (1000 جرام)";
  if (grams > 1000) return (grams / 1000).toFixed(2).replace(/\.?0+$/, "") + " كيلو (" + grams + " جرام)";
  return grams + " جرام";
}

function aggregateItems(items: Array<{ productId: number; quantity: number; name?: string; variant?: string; customAmount?: number }>) {
  const map = new Map<number, { quantity: number; customAmountTotal: number; name?: string }>();
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

function quoteFingerprint(lines: Array<{ productId: number; name: string; quantity: number; unit: string; price: number; lineTotal: number }>, totals: { subtotal: number; deliveryFee: number; discount: number; total: number }, currency: string, offerId: number | null) {
  return createHash("sha256").update(JSON.stringify({ lines, totals, currency, offerId })).digest("hex");
}

const assistantRateWindows = new Map<string, { startedAt: number; count: number }>();
function enforceAssistantRateLimit(key: string) {
  const now = Date.now();
  if (assistantRateWindows.size > 5000) {
    for (const [entryKey, entry] of assistantRateWindows) if (now - entry.startedAt >= 60_000) assistantRateWindows.delete(entryKey);
  }
  const current = assistantRateWindows.get(key);
  if (!current || now - current.startedAt >= 60_000) { assistantRateWindows.set(key, { startedAt: now, count: 1 }); return; }
  if (current.count >= 200) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "وصلت إلى حد المحادثة المؤقت. حاول مجددًا بعد دقيقة؛ ويمكنك متابعة التسوق من الأقسام." });
  current.count += 1;
}
function isDuplicateEntry(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const dbError = error as { code?: unknown; errno?: unknown };
  return dbError.code === "ER_DUP_ENTRY" || dbError.errno === 1062;
}

const categoryInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  imageUrl: z.string().max(8500000).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#397a54"),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(-10000).max(10000).default(0),
});

const productInput = z.object({
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(5000).optional().nullable(),
  imageUrl: z.string().max(8500000).optional().nullable(),
  categoryId: safeId.nullable().optional(),
  price: z.number().int().min(0).max(100000000),
  unit: z.string().trim().min(1).max(40),
  stock: z.number().int().min(0).max(100000000).nullable().optional(),
  minQuantity: z.number().int().min(1).max(1000000).default(1),
  quantityStep: z.number().int().min(1).max(1000000).default(1),
  isPublished: z.boolean().default(false),
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().int().min(-10000).max(10000).default(0),
});

// --- LIVE_CHAT_STORE_START ---
export type LiveChatMsg = { id: string; role: "user" | "assistant" | "owner"; sender: string; text: string; createdAt: string };
export type LiveChatSession = { sessionId: string; customerName: string; customerPhone: string; aiPaused: boolean; updatedAt: string; messages: LiveChatMsg[] };
const liveChatsMemory = new Map<string, LiveChatSession>();
let liveChatsLoaded = false;

async function loadLiveChats(db: any) {
  if (liveChatsLoaded || !db) return;
  liveChatsLoaded = true;
  try {
    const rows = await db.select().from(storeSettings).where(eq(storeSettings.key, "live_ai_chats_v1")).limit(1);
    if (rows[0]?.value) {
      const parsed = JSON.parse(rows[0].value) as LiveChatSession[];
      if (Array.isArray(parsed)) {
        for (const s of parsed) if (s?.sessionId) liveChatsMemory.set(s.sessionId, s);
      }
    }
  } catch {}
}

async function saveLiveChats(db: any) {
  if (!db) return;
  try {
    const arr = [...liveChatsMemory.values()]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 60)
      .map(s => ({ ...s, messages: s.messages.slice(-50) }));
    const stored = JSON.stringify(arr);
    await db.insert(storeSettings).values({ key: "live_ai_chats_v1", value: stored }).onDuplicateKeyUpdate({ set: { value: stored } });
  } catch {}
}
// --- LIVE_CHAT_STORE_END ---
// --- FAST_IMG_HELPER_START ---
const HTTP_PRE = ["ht", "tp"].join("");
function toFastImg<T extends { id: number; imageUrl?: string | null; updatedAt?: Date | string | null }>(kind: "product" | "category" | "banner", row: T): T {
  if (!row || !row.imageUrl) return row;
  const raw = String(row.imageUrl).trim();
  if (!raw || raw.startsWith("/api/fast-img/")) return row;
  try {
    const cacheMap: Map<string, { contentType: string; buf: Buffer }> = (globalThis as any).__fastImgCache || ((globalThis as any).__fastImgCache = new Map());
    const cacheKey = kind + ":" + row.id;
    const ver = row.updatedAt ? new Date(row.updatedAt).getTime() : ((globalThis as any).__catalogVer || 1);
    if (raw.startsWith("data:image/")) {
      const m = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
      if (m) cacheMap.set(cacheKey, { contentType: m[1], buf: Buffer.from(m[2], "base64") });
      return { ...row, imageUrl: "/api/fast-img/" + kind + "/" + row.id + "?v=" + ver };
    }
    if (raw.startsWith(HTTP_PRE)) {
      if (!cacheMap.has(cacheKey)) {
        void fetch(raw).then(async r => {
          if (r.ok) {
            const ct = r.headers.get("content-type") || "image/webp";
            const ab = await r.arrayBuffer();
            cacheMap.set(cacheKey, { contentType: ct, buf: Buffer.from(ab) });
          }
        }).catch(() => {});
      }
      return { ...row, imageUrl: "/api/fast-img/" + kind + "/" + row.id + "?v=" + ver };
    }
    return row;
  } catch {
    return row;
  }
}

let __refreshingHomePromise: Promise<any> | null = null;
let __orderItemsSchemaFixed = false;
async function ensureOrderItemsFastSchema(dbInstance?: any) {
  if (__orderItemsSchemaFixed) return;
  try {
    const db = dbInstance || (await database());
    if (!db) return;
    __orderItemsSchemaFixed = true;
    try { await db.execute(sql.raw("ALTER TABLE order_items MODIFY COLUMN productImage LONGTEXT NULL")); } catch {}
    try { await db.execute(sql.raw("UPDATE order_items SET productImage = CONCAT('/api/fast-img/product/', productId) WHERE productId IS NOT NULL AND productImage LIKE 'data:image/%'")); } catch {}
  } catch {}
}
function normalizeOrderItemImage<T extends { productId?: number | null; productImage?: string | null }>(item: T): T {
  if (!item || !item.productImage) return item;
  if (item.productImage.startsWith("data:image/")) {
    return { ...item, productImage: item.productId ? ("/api/fast-img/product/" + item.productId) : null };
  }
  return item;
}

async function refreshHomeCatalogCache() {
  if (__refreshingHomePromise) return __refreshingHomePromise;
  __refreshingHomePromise = (async () => {
    try {
      const db = await database();
      void ensureOrderItemsFastSchema(db);
      const [categoryRows, productRows, bannerRows, offerRows, settings] = await Promise.all([
        db.select().from(categories).where(eq(categories.isActive, true)).orderBy(asc(categories.sortOrder), asc(categories.id)),
        db.select().from(products).where(and(eq(products.isPublished, true), eq(products.isAvailable, true))).orderBy(asc(products.sortOrder), desc(products.createdAt)).limit(500),
        db.select().from(banners).where(and(eq(banners.isActive, true))).orderBy(asc(banners.sortOrder), desc(banners.createdAt)),
        db.select().from(offers).where(and(eq(offers.isActive, true))).orderBy(desc(offers.createdAt)),
        readSettings(db),
      ]);
      const validBanners = bannerRows.filter(b => Boolean(b.imageUrl && b.imageUrl.trim()));
      const g = globalThis as any;
      g.__fastHomeData = {
        categories: categoryRows.map(r => toFastImg("category", r)),
        products: productRows.map(r => toFastImg("product", r)),
        banners: validBanners.map(r => toFastImg("banner", r)),
        offers: offerRows,
        settings,
      };
      g.__fastHomeTime = Date.now();
      return g.__fastHomeData;
    } finally {
      __refreshingHomePromise = null;
    }
  })();
  return __refreshingHomePromise;
}
(globalThis as any).__loadCatalogHome = refreshHomeCatalogCache;
setTimeout(() => { void refreshHomeCatalogCache().catch(() => {}); }, 80);
// --- FAST_IMG_HELPER_END ---
export const commerceRouter = router({
    access: publicProcedure.query(({ ctx }) => {
    const isAdminActive = ctx.user?.role === "admin" && !ctx.user.suspended;
    const isOwner = Boolean(ctx.user?.isOwner ?? (isAdminActive && !ctx.user?.adminRole));
    const adminRole = (ctx.user?.adminRole ?? (isOwner ? "owner" : null)) as AdminRoleKey | null;
    const permissions = (ctx.user?.permissions ?? (isOwner ? [...PERMISSION_KEYS] : [])) as PermissionKey[];
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
      isSuspended: Boolean(ctx.user?.suspended),
    };
  }),

  notifications: router({
    publicKey: publicProcedure.query(() => getWebPushPublicKey()),
  }),

  catalog: router({
    home: publicProcedure.query(async () => {
      const now = Date.now();
      const g = globalThis as any;
      if (g.__fastHomeData) {
        if (now - (g.__fastHomeTime || 0) > 600000) {
          void refreshHomeCatalogCache().catch(() => {});
        }
        return g.__fastHomeData;
      }
      return await refreshHomeCatalogCache();
    }),
    listProducts: publicProcedure.input(z.object({
      search: z.string().trim().max(120).optional(),
      categoryId: safeId.optional(),
      sort: z.enum(["featured", "price-asc", "price-desc", "name"]).default("featured"),
      limit: z.number().int().min(1).max(500).default(250),
    }).optional()).query(async ({ input }) => {
      const g = globalThis as any;
      let base: any[] = g.__fastHomeData?.products;
      if (!Array.isArray(base)) {
        const homeData = await refreshHomeCatalogCache();
        base = homeData?.products || [];
      }
      let list = [...base];
      if (input?.categoryId) list = list.filter(p => p.categoryId === input.categoryId);
      if (input?.search) {
        const q = input.search.toLowerCase();
        list = list.filter(p => String(p.name || "").toLowerCase().includes(q) || String(p.description || "").toLowerCase().includes(q));
      }
      if (input?.sort === "price-asc") list.sort((a, b) => a.price - b.price);
      else if (input?.sort === "price-desc") list.sort((a, b) => b.price - a.price);
      else if (input?.sort === "name") list.sort((a, b) => String(a.name).localeCompare(String(b.name), "ar"));
      return list.slice(0, input?.limit ?? 250);
    }),
    listCategories: publicProcedure.query(async () => {
      const g = globalThis as any;
      if (Array.isArray(g.__fastHomeData?.categories)) return g.__fastHomeData.categories;
      const homeData = await refreshHomeCatalogCache();
      return homeData?.categories || [];
    }),
    product: publicProcedure.input(z.object({ id: safeId.optional(), slug: z.string().max(220).optional() })).query(async ({ input }) => getCached("product:" + JSON.stringify(input), 60_000, async () => {
      const db = await database();
      const product = (await db.select().from(products).where(and(
        input.id ? eq(products.id, input.id) : eq(products.slug, input.slug ?? ""),
        eq(products.isPublished, true), eq(products.isAvailable, true),
      )).limit(1))[0];
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "المنتج غير متاح." });
      const linked = await db.select({ product: products }).from(productRecommendations)
        .innerJoin(products, eq(productRecommendations.recommendedProductId, products.id))
        .where(and(eq(productRecommendations.productId, product.id), eq(products.isPublished, true), eq(products.isAvailable, true)));
      return { ...toFastImg("product", product), recommendations: linked.map(row => toFastImg("product", row.product)) };
    })),
    productsForReorder: publicProcedure.input(z.object({ ids: z.array(safeId).min(1).max(500) })).query(async ({ input }) => {
      const db = await database();
      const rows = await db.select().from(products).where(and(inArray(products.id, [...new Set(input.ids)]), eq(products.isPublished, true), eq(products.isAvailable, true))); return rows.map(r => toFastImg('product', r));
    }),
  }),

  profile: router({
    updateName: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(120) })).mutation(async ({ ctx, input }) => {
      const db = await database();
      await db.update(users).set({ name: input.name }).where(eq(users.id, ctx.user.id));
      clearCatalogCache(); return { success: true };
    }),
    updatePhone: protectedProcedure.input(z.object({ phone: z.string().trim().min(7).max(32) })).mutation(async ({ ctx, input }) => {
      const db = await database();
      await db.update(users).set({ phone: input.phone }).where(eq(users.id, ctx.user.id));
      clearCatalogCache(); return { success: true };
    }),
    addresses: protectedProcedure.query(async ({ ctx }) => {
      const db = await database();
      return db.select().from(addresses).where(eq(addresses.userId, ctx.user.id)).orderBy(desc(addresses.isDefault), desc(addresses.id));
    }),
    saveAddress: protectedProcedure.input(z.object({
      id: safeId.optional(), label: z.string().trim().min(1).max(80), recipientName: z.string().trim().min(2).max(160),
      phone: z.string().trim().min(7).max(32), city: z.string().trim().min(1).max(100), district: z.string().trim().min(1).max(120),
      details: z.string().trim().max(1000).optional().nullable(), isDefault: z.boolean().default(false),
    })).mutation(async ({ ctx, input }) => {
      const db = await database();
      await db.transaction(async tx => {
        if (input.isDefault) await tx.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, ctx.user.id));
        const values = { userId: ctx.user.id, label: input.label, recipientName: input.recipientName, phone: normalizeYemeniPhone(input.phone), city: input.city, district: input.district, details: input.details ?? null, isDefault: input.isDefault };
        if (input.id) {
          const owned = (await tx.select({ id: addresses.id }).from(addresses).where(and(eq(addresses.id, input.id), eq(addresses.userId, ctx.user.id))).limit(1))[0];
          if (!owned) throw new TRPCError({ code: "NOT_FOUND", message: "العنوان غير موجود في حسابك." });
          await tx.update(addresses).set(values).where(and(eq(addresses.id, input.id), eq(addresses.userId, ctx.user.id)));
        }
        else await tx.insert(addresses).values(values);
      });
      clearCatalogCache(); return { success: true };
    }),
    deleteAddress: protectedProcedure.input(z.object({ id: safeId })).mutation(async ({ ctx, input }) => {
      const db = await database();
      await db.delete(addresses).where(and(eq(addresses.id, input.id), eq(addresses.userId, ctx.user.id)));
      clearCatalogCache(); return { success: true };
    }),
  }),

  favorites: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await database();
      const rows = await db.select({ product: products }).from(favorites).innerJoin(products, eq(favorites.productId, products.id))
        .where(and(eq(favorites.userId, ctx.user.id), eq(products.isPublished, true), eq(products.isAvailable, true)));
      return rows.map(row => row.product);
    }),
    toggle: protectedProcedure.input(z.object({ productId: safeId })).mutation(async ({ ctx, input }) => {
      const db = await database();
      const product = (await db.select({ id: products.id }).from(products).where(and(eq(products.id, input.productId), eq(products.isPublished, true), eq(products.isAvailable, true))).limit(1))[0];
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "المنتج غير متاح." });
      const existing = (await db.select().from(favorites).where(and(eq(favorites.userId, ctx.user.id), eq(favorites.productId, input.productId))).limit(1))[0];
      if (existing) await db.delete(favorites).where(eq(favorites.id, existing.id));
      else await db.insert(favorites).values({ userId: ctx.user.id, productId: input.productId });
      return { saved: !existing };
    }),
  }),

  orders: router({
    quote: publicProcedure.input(z.object({
      items: z.array(z.object({ productId: safeId, quantity: z.number().int().min(1).max(10000), name: z.string().trim().max(220).optional(), variant: z.string().trim().max(120).optional(), customAmount: z.number().int().min(1).max(100000000).optional() })).min(1).max(100),
      city: z.string().trim().min(1).max(100), district: z.string().trim().max(160).optional(), phone: z.string().trim().max(40).optional(), offerCode: z.string().trim().max(40).optional(),
    })).mutation(async ({ input }) => {
      const db = await database();
      const settings = await readSettings(db);
      if (settings.orderPaused === "true") throw new TRPCError({ code: "PRECONDITION_FAILED", message: settings.pausedMessage || "استقبال الطلبات متوقف مؤقتًا." });
      const prelimFee = deliveryFeeForCity(settings, input.city, input.district, input.phone, 0);
      if (prelimFee === null) throw new TRPCError({ code: "PRECONDITION_FAILED", message: settings.deliveryEnabled === "true" ? "منطقة التوصيل أو رسومها غير محددة بعد." : "لم يفعّل المتجر التوصيل بعد." });
      const requested = aggregateItems(input.items);
      if (requested.some(item => item.quantity > 10000)) throw new TRPCError({ code: "BAD_REQUEST", message: "الكمية الإجمالية لأحد المنتجات تتجاوز الحد المسموح." });
      const productIds = requested.map(item => item.productId);
      const currentProducts = await db.select({ id: products.id, name: products.name, description: products.description, price: products.price, unit: products.unit, stock: products.stock, minQuantity: products.minQuantity, quantityStep: products.quantityStep }).from(products).where(and(inArray(products.id, productIds), eq(products.isPublished, true), eq(products.isAvailable, true)));
      if (currentProducts.length !== productIds.length) {
        const foundIds = new Set(currentProducts.map(p => p.id));
        const missingReq = requested.filter(r => !foundIds.has(r.productId));
        const missingIds = missingReq.map(r => r.productId);
        const dbMissing = missingIds.length ? await db.select({ id: products.id, name: products.name }).from(products).where(inArray(products.id, missingIds)) : [];
        const histMissing = missingIds.length ? await db.select({ productId: orderItems.productId, name: orderItems.productName }).from(orderItems).where(inArray(orderItems.productId, missingIds)).limit(30) : [];
        const missingNames = missingReq.map(r => r.name || dbMissing.find(d => d.id === r.productId)?.name || histMissing.find(h => h.productId === r.productId)?.name || ("منتج #" + r.productId));
        for (const mid of missingIds) clearCatalogCache(mid);
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "المنتج «" + missingNames.join("، ") + "» لم يعد متوفراً حالياً في المتجر. تم تحديث السلة تلقائياً." });
      }
      const lines = requested.map(item => {
        const product = currentProducts.find(row => row.id === item.productId)!;
        const wcfg = unpackServerProductWeightCfg(product.description);
        if (wcfg.enabled && item.customAmountTotal > 0) {
          if (item.customAmountTotal < wcfg.minAmount) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "أقل مبلغ مسموح لشراء «" + product.name + "» هو " + wcfg.minAmount.toLocaleString("en-US") + " ر.ي." });
          }
          if (product.stock !== null && product.stock < 1) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "الكمية المتوفرة من «" + product.name + "» لا تكفي." });
          }
          const grams = Math.max(1, Math.round((item.customAmountTotal / Math.max(1, product.price)) * 1000));
          const weightUnit = formatServerWeightGrams(grams);
          return { productId: product.id, name: product.name, quantity: 1, unit: weightUnit, price: item.customAmountTotal, lineTotal: item.customAmountTotal };
        }
        if (item.quantity < product.minQuantity || (item.quantity - product.minQuantity) % product.quantityStep !== 0) throw new TRPCError({ code: "BAD_REQUEST", message: "الكمية المطلوبة من «" + product.name + "» لا توافق وحدة البيع." });
        if (product.stock !== null && product.stock < item.quantity) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "الكمية المتوفرة من «" + product.name + "» لا تكفي." });
        return { productId: product.id, name: product.name, quantity: item.quantity, unit: product.unit, price: product.price, lineTotal: product.price * item.quantity };
      });
      const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
      if (!Number.isSafeInteger(subtotal) || subtotal > 100000000000) throw new TRPCError({ code: "BAD_REQUEST", message: "إجمالي السلة يتجاوز الحد المسموح." });
      let appliedOffer: typeof offers.$inferSelect | null = null;
      if (input.offerCode) {
        appliedOffer = (await db.select().from(offers).where(and(eq(offers.code, input.offerCode.trim().toUpperCase()), eq(offers.isActive, true), sql`(${offers.startsAt} is null or ${offers.startsAt} <= now())`, sql`(${offers.endsAt} is null or ${offers.endsAt} >= now())`)).limit(1))[0] ?? null;
        if (!appliedOffer) throw new TRPCError({ code: "BAD_REQUEST", message: "رمز العرض غير صالح أو غير نشط." });
      }
      const deliveryFee = deliveryFeeForCity(settings, input.city, input.district, input.phone, subtotal) ?? prelimFee;
      const totals = orderTotals(subtotal, deliveryFee, appliedOffer, settings);
      const currency = settings.currency || "ر.ي";
      return { lines, ...totals, currency, quoteHash: quoteFingerprint(lines, totals, currency, appliedOffer?.id ?? null), offerTitle: appliedOffer?.title ?? null };
    }),
    trackMany: publicProcedure.input(z.object({
      refs: z.array(z.object({
        orderNumber: z.string().trim().min(6).max(40).regex(/^(?:SH|OR)-[A-Z0-9]+-[A-Z0-9]{5}$/i),
        idempotencyKey: z.string().uuid(),
      })).min(1).max(50),
    })).query(async ({ input }) => {
      const db = await database();
      const referenceByNumber = new Map(input.refs.map(reference => [reference.orderNumber, reference.idempotencyKey]));
      const candidates = await db.select().from(orders)
        .where(inArray(orders.orderNumber, [...referenceByNumber.keys()])).orderBy(desc(orders.createdAt), desc(orders.id)).limit(50);
      const authorized = candidates.filter(order => {
        const key = referenceByNumber.get(order.orderNumber);
        return key ? matchesGuestOrderKey(key, order.idempotencyKey) : false;
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
        orderNumber: z.string().trim().min(6).max(40).regex(/^(?:SH|OR)-[A-Z0-9]+-[A-Z0-9]{5}$/i),
        idempotencyKey: z.string().uuid(),
      })).min(1).max(50),
      subscription: pushSubscriptionSchema,
    })).mutation(async ({ input }) => {
      if (!isAllowedPushEndpoint(input.subscription.endpoint)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "خدمة الإشعارات في هذا المتصفح غير مدعومة." });
      }
      const db = await database();
      const referenceByNumber = new Map(input.refs.map(reference => [reference.orderNumber, reference.idempotencyKey]));
      const candidates = await db.select({ id: orders.id, orderNumber: orders.orderNumber, idempotencyKey: orders.idempotencyKey })
        .from(orders).where(inArray(orders.orderNumber, [...referenceByNumber.keys()])).limit(50);
      const authorized = candidates.filter(order => {
        const key = referenceByNumber.get(order.orderNumber);
        return key ? matchesGuestOrderKey(key, order.idempotencyKey) : false;
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
    }),
    mine: protectedProcedure.query(async ({ ctx }) => {
      const db = await database();
      const rows = await db.select().from(orders).where(eq(orders.userId, ctx.user.id)).orderBy(desc(orders.createdAt)).limit(100);
      if (!rows.length) return [];
      const orderIds = rows.map(row => sql`${row.id}`);
      const [items, events] = await Promise.all([
        db.select().from(orderItems).where(sql`${orderItems.orderId} in (${sql.join(orderIds, sql`, `)})`),
        db.select().from(orderEvents).where(sql`${orderEvents.orderId} in (${sql.join(orderIds, sql`, `)})`).orderBy(asc(orderEvents.createdAt)),
      ]);
      return rows.map(order => ({ ...order, items: items.filter(item => item.orderId === order.id), events: events.filter(event => event.orderId === order.id) }));
    }),
    place: publicProcedure.input(z.object({
      idempotencyKey: z.string().uuid(),
      expectedTotal: z.number().int().min(0).max(100000000000),
      expectedQuoteHash: z.string().length(64).regex(/^[a-f0-9]+$/),
      items: z.array(z.object({ productId: safeId, quantity: z.number().int().min(1).max(10000), name: z.string().trim().max(220).optional(), variant: z.string().trim().max(120).optional(), customAmount: z.number().int().min(1).max(100000000).optional() })).min(1).max(100),
      offerCode: z.string().trim().max(40).optional(),
      recipientName: z.string().trim().min(2).max(160), phone: z.string().trim().min(7).max(32).refine(isValidGuestPhone, "يرجى إدخال رقم جوال يمني صحيح مكون من 9 أرقام ويبدأ بـ 77 أو 73 أو 78 أو 71 أو 70."),
      city: z.string().trim().min(1).max(100), district: z.string().trim().min(1).max(120), addressDetails: z.string().trim().max(1000).optional(), customerNote: z.string().trim().max(1000).optional(),
    })).mutation(async ({ ctx, input }) => {
      const db = await database();
      const requested = aggregateItems(input.items);
      if (requested.some(item => item.quantity > 10000)) throw new TRPCError({ code: "BAD_REQUEST", message: "الكمية الإجمالية لأحد المنتجات تتجاوز الحد المسموح." });
      const storedIdempotencyKey = hashGuestOrderKey(input.idempotencyKey);
      const existing = (await db.select().from(orders).where(inArray(orders.idempotencyKey, [storedIdempotencyKey, input.idempotencyKey])).limit(1))[0];
      if (existing) return { id: existing.id, orderNumber: existing.orderNumber, total: existing.total, duplicate: true };
      if (typeof enforceOrderCreateRateLimit === "function") enforceOrderCreateRateLimit(getClientIp(ctx.req));
      const settings = await readSettings(db);
      if (settings.orderPaused === "true") throw new TRPCError({ code: "PRECONDITION_FAILED", message: settings.pausedMessage || "استقبال الطلبات متوقف مؤقتًا." });
      const prelimDeliveryFee = deliveryFeeForCity(settings, input.city, input.district, input.phone, 0);
      if (prelimDeliveryFee === null) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "منطقة التوصيل أو رسومها غير محددة بعد." });

      let appliedOffer: typeof offers.$inferSelect | null = null;
      if (input.offerCode) {
        const code = input.offerCode.trim().toUpperCase();
        appliedOffer = (await db.select().from(offers).where(and(eq(offers.code, code), eq(offers.isActive, true), sql`(${offers.startsAt} is null or ${offers.startsAt} <= now())`, sql`(${offers.endsAt} is null or ${offers.endsAt} >= now())`)).limit(1))[0] ?? null;
        if (!appliedOffer) throw new TRPCError({ code: "BAD_REQUEST", message: "رمز العرض غير صالح أو غير نشط." });
      }

      await ensureOrderItemsFastSchema(db);
      const result = await db.transaction(async tx => {
        const orderLines: Array<{ product: { id: number; name: string; description: string | null; price: number; unit: string; stock: number | null; minQuantity: number; quantityStep: number }; quantity: number; effectiveUnit: string; effectivePrice: number; effectiveLineTotal: number; isWeighed: boolean }> = [];
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
            quantityStep: products.quantityStep,
          }).from(products).where(and(eq(products.id, item.productId), eq(products.isPublished, true), eq(products.isAvailable, true))).limit(1).for("update"))[0];
          if (!product) {
            const anyProd = (await tx.select({ name: products.name }).from(products).where(eq(products.id, item.productId)).limit(1))[0];
            const missingName = item.name || anyProd?.name || ("منتج #" + item.productId);
            clearCatalogCache(item.productId);
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "المنتج «" + missingName + "» لم يعد متوفراً حالياً في المتجر. تم تحديث السلة تلقائياً." });
          }
          const wcfg = unpackServerProductWeightCfg(product.description);
          if (wcfg.enabled && item.customAmountTotal > 0) {
            if (item.customAmountTotal < wcfg.minAmount) {
              throw new TRPCError({ code: "BAD_REQUEST", message: "أقل مبلغ مسموح لشراء «" + product.name + "» هو " + wcfg.minAmount.toLocaleString("en-US") + " ر.ي." });
            }
            if (product.stock !== null && product.stock < 1) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "الكمية المتوفرة من «" + product.name + "» لا تكفي." });
            const grams = Math.max(1, Math.round((item.customAmountTotal / Math.max(1, product.price)) * 1000));
            const weightUnit = formatServerWeightGrams(grams);
            subtotal += item.customAmountTotal;
            if (!Number.isSafeInteger(subtotal) || subtotal > 100000000000) throw new TRPCError({ code: "BAD_REQUEST", message: "إجمالي السلة يتجاوز الحد المسموح." });
            orderLines.push({ product, quantity: 1, effectiveUnit: weightUnit, effectivePrice: item.customAmountTotal, effectiveLineTotal: item.customAmountTotal, isWeighed: true });
          } else {
            if (item.quantity < product.minQuantity || (item.quantity - product.minQuantity) % product.quantityStep !== 0) {
              throw new TRPCError({ code: "BAD_REQUEST", message: "الكمية المطلوبة من «" + product.name + "» لا توافق وحدة البيع." });
            }
            if (product.stock !== null && product.stock < item.quantity) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "الكمية المتوفرة من «" + product.name + "» لا تكفي." });
            const lineTotal = product.price * item.quantity;
            subtotal += lineTotal;
            if (!Number.isSafeInteger(subtotal) || subtotal > 100000000000) throw new TRPCError({ code: "BAD_REQUEST", message: "إجمالي السلة يتجاوز الحد المسموح." });
            orderLines.push({ product, quantity: item.quantity, effectiveUnit: product.unit, effectivePrice: product.price, effectiveLineTotal: lineTotal, isWeighed: false });
          }
        }
        const finalDeliveryFee = deliveryFeeForCity(settings, input.city, input.district, input.phone, subtotal) ?? prelimDeliveryFee;
        const totals = orderTotals(subtotal, finalDeliveryFee, appliedOffer, settings);
        const currency = settings.currency || "ر.ي";
        const currentLines = orderLines.map(line => ({ productId: line.product.id, name: line.product.name, quantity: line.quantity, unit: line.effectiveUnit, price: line.effectivePrice, lineTotal: line.effectiveLineTotal }));
        const currentQuoteHash = quoteFingerprint(currentLines, totals, currency, appliedOffer?.id ?? null);
        if (totals.total !== input.expectedTotal || currentQuoteHash !== input.expectedQuoteHash) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "تغيّر السعر أو التوفر أو رسوم التوصيل بعد المعاينة. اعرض الملخص المحدّث قبل تأكيد الطلب." });
        const orderNumber = "SH-" + Date.now().toString(36).toUpperCase() + "-" + nanoid(5).toUpperCase();
        const inserted = await tx.insert(orders).values({
          orderNumber, idempotencyKey: storedIdempotencyKey, userId: null, offerId: appliedOffer?.id ?? null,
          recipientName: input.recipientName, phone: normalizeYemeniPhone(input.phone), city: input.city, district: input.district,
          addressDetails: input.addressDetails ?? null, customerNote: input.customerNote ?? null,
          subtotal, deliveryFee: totals.deliveryFee, discount: totals.discount, total: totals.total, status: "new",
        });
        const orderId = Number(inserted[0].insertId);
        for (const line of orderLines) {
          const vParts = input.items.filter(i => i.productId === line.product.id && i.variant && i.variant.trim()).map(i => (!line.isWeighed && i.quantity > 1) ? (i.variant!.trim() + " × " + i.quantity) : i.variant!.trim());
          const baseTitle = vParts.length > 0 ? (line.product.name + " (" + vParts.join("، ") + ")") : (line.isWeighed ? (line.product.name + " (⚖️ " + line.effectiveUnit + ")") : line.product.name);
          const finalProdName = baseTitle.slice(0, 180);
          await tx.insert(orderItems).values({
            orderId, productId: line.product.id, productName: finalProdName, productImage: "/api/fast-img/product/" + line.product.id,
            unit: line.effectiveUnit, unitPrice: line.effectivePrice, quantity: line.quantity, lineTotal: line.effectiveLineTotal,
          });
          if (line.product.stock !== null) {
            await tx.update(products).set({ stock: Math.max(0, line.product.stock - line.quantity) }).where(eq(products.id, line.product.id));
          }
        }
        if (typeof isRewardCurrentlyActive === "function") {
          const rewardStatus = isRewardCurrentlyActive(settings, subtotal);
          if (rewardStatus.active && (rewardStatus.cfg.giftName || rewardStatus.cfg.rewardMode === "custom_gift")) {
            const giftLabel = rewardStatus.cfg.giftName || rewardStatus.cleanMessage || "هدية مجانية من شهيزو";
            await tx.insert(orderItems).values({
              orderId, productId: null, productName: ("🎁 هدية العرض المجانية: " + giftLabel).slice(0, 180),
              productImage: null, unit: "هدية مجانية", unitPrice: 0, quantity: 1, lineTotal: 0,
            });
          }
        }
        await tx.insert(orderEvents).values({ orderId, status: "new", note: "تم استلام الطلب", changedByUserId: null });
        return { id: orderId, orderNumber, total: totals.total, duplicate: false };
      }).catch(async error => {
        if (!isDuplicateEntry(error)) {
          if (error instanceof TRPCError) throw error;
          console.error("[Order Place Error]", String(error?.message || error).slice(0, 300));
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر حفظ الطلب مؤقتاً، يرجى الضغط على تأكيد الطلب مرة أخرى." });
        }
        const concurrent = (await db.select().from(orders).where(inArray(orders.idempotencyKey, [storedIdempotencyKey, input.idempotencyKey])).limit(1))[0];
        if (!concurrent) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر التحقق من الطلب، يرجى المحاولة مرة أخرى." });
        return { id: concurrent.id, orderNumber: concurrent.orderNumber, total: concurrent.total, duplicate: true };
      });
      if (!result.duplicate) {
        void notifyOwnerNewOrder(result.id, result.orderNumber, result.total, input.recipientName, input.city + " - " + input.district)
          .catch(() => console.warn("[Push] Could not notify owner of a new order"));
      }
      return result;
    }),
  }),

  assistant: router({
    pollMessages: publicProcedure.input(z.object({
      sessionId: z.string().trim().min(1).max(80),
    })).query(async ({ input }) => {
      const db = await getDb();
      const settings = db ? await readSettings(db) : { deliveryEnabled: "true", deliveryFee: "0" };
      await loadLiveChats(db);
      const session = liveChatsMemory.get(input.sessionId);
      return {
        aiPaused: session?.aiPaused ?? false,
        ownerMessages: (session?.messages ?? []).filter(m => m.role === "owner"),
      };
    }),
    recipe: publicProcedure.input(z.object({
      request: z.string().trim().min(1).max(1200),
      history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(1800) })).max(20).optional(),
      cart: z.array(z.object({ productId: safeId, quantity: z.number().int().min(1).max(10000) })).max(100).optional(),
      favoriteProductIds: z.array(safeId).max(500).optional(),
      sessionId: z.string().max(80).optional(),
      customerName: z.string().max(160).optional(),
      customerPhone: z.string().max(40).optional(),
    })).mutation(async ({ input, ctx }) => {
      const clientKey = ctx.user ? "user:" + ctx.user.id : "ip:" + (ctx.req.ip || "unknown-client");
      enforceAssistantRateLimit(clientKey.slice(0, 120));
      const db = await getDb();
      await loadLiveChats(db);

      const sid = (input.sessionId?.trim() || clientKey).slice(0, 80);
      const customerNameClean = input.customerName?.trim() || "زبون المتجر";
      const customerPhoneClean = input.customerPhone?.trim() || "غير مسجل بالموقع";
      const nowIso = new Date().toISOString();

      let chatSession = liveChatsMemory.get(sid);
      if (!chatSession) {
        chatSession = {
          sessionId: sid,
          customerName: customerNameClean,
          customerPhone: customerPhoneClean,
          aiPaused: false,
          updatedAt: nowIso,
          messages: [],
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
        createdAt: nowIso,
      });
      await saveLiveChats(db);

      if (chatSession.aiPaused) {
        return {
          message: "تم إرسال رسالتك إلى إدارة المتجر مباشرة، وسيرد عليك المالك هنا في المحادثة خلال لحظات...",
          recipe: null,
          ingredients: [],
          missingIngredients: [],
          cartAction: null,
          suggestedQuestions: ["عرض السلة", "تصفح المنتجات"],
        };
      }

      const [catalogRows, catRows] = db ? await Promise.all([
        db.select({ id: products.id, name: products.name, description: products.description, categoryId: products.categoryId, price: products.price, unit: products.unit, stock: products.stock, minQuantity: products.minQuantity, quantityStep: products.quantityStep }).from(products).where(and(eq(products.isPublished, true), eq(products.isAvailable, true))).limit(150).catch(() => []),
        db.select({ id: categories.id, name: categories.name }).from(categories).catch(() => []),
      ]) : [[], []];
      const catNameById = new Map(catRows.map((c: any) => [c.id, c.name]));
      const catalog = catalogRows.filter(product => product.stock === null || product.stock > 0) as AssistantCatalogProduct[];
      const catalogById = new Map(catalog.map(product => [product.id, product]));
      const currentCart = (input.cart ?? []).flatMap(line => {
        const product = catalogById.get(line.productId);
        return product ? [{ productId: product.id, quantity: line.quantity, name: product.name, unit: product.unit }] : [];
      });
      const favoriteIds = [...new Set(input.favoriteProductIds ?? [])].filter(id => catalogById.has(id)).slice(0, 100);
      const customerFavorites = (favoriteIds.length && db)
        ? await db.select({ id: products.id, name: products.name }).from(products)
          .where(and(inArray(products.id, favoriteIds), eq(products.isPublished, true), eq(products.isAvailable, true)))
          .limit(100)
        : [];

      const history = (input.history ?? []).slice(-8).map(turn =>
        (turn.role === "user" ? "العميل" : "المساعد") + ": " + turn.text.trim().slice(0, 400),
      ).join("\n");

      const userPrompt = [
        "المنتجات المتاحة (مصدر الحقيقة الوحيد): " + JSON.stringify(catalog.slice(0, 80).map((p: any) => ({ id: p.id, name: p.name, category: catNameById.get(p.categoryId) || "عام", price: p.price, unit: p.unit }))),
        "مفضلات العميل: " + JSON.stringify(customerFavorites),
        "السلة الحالية: " + JSON.stringify(currentCart),
        history ? "سجل المحادثة السابق:\n" + history : "لا يوجد سياق سابق.",
        "رسالة العميل الحالية:\n" + input.request,
      ].join("\n\n");

      let output: AssistantModelOutput | null = null;
      try {
        const aiInst = db ? (await readSettings(db)).aiInstructions : "";
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "أنت الشيف والمساعد الذكي لبوفية ومطعم شهيزو (SHAHEZO) للشاورما والفلافل والعصائر في اليمن." },
            { role: "user", content: userPrompt + (aiInst ? "\n\nتوجيهات مالك المتجر الخاصة:\n" + aiInst : "") },
          ],
          response_format: { type: "json_object" },
        });
        const structuredContent = response.choices?.[0]?.message?.content;
        output = parseAssistantModelContent(structuredContent);
      } catch (err) {
        console.error("[AI Assistant Error]", err);
      }

      if (!output) {
        throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى." });
      }

      const prepared = (prepareAssistantResponse as any)(output, catalog, input.cart ?? [], input.request, input.history ?? []);

      chatSession.messages.push({
        id: nanoid(10),
        role: "assistant",
        sender: "المساعد الذكي",
        text: prepared.message,
        createdAt: new Date().toISOString(),
      });
      chatSession.updatedAt = new Date().toISOString();
      void saveLiveChats(db);

      const missingItems = output.missingIngredients ?? [];
      if (missingItems.length > 0 && db) {
        const requestedItemText = missingItems.join("، ").replace(/^طلب توفير:\s*/i, "").trim().slice(0, 180);
        void (async () => {
          try {
            const orderNumber = "REQ-" + Date.now().toString(36).toUpperCase().slice(-4) + "-" + nanoid(4).toUpperCase();
            const inserted = await db.insert(orders).values({
              orderNumber,
              idempotencyKey: "req-" + nanoid(22),
              userId: ctx.user?.id ?? null,
              offerId: null,
              recipientName: "🔔 طلب توفير (" + customerNameClean + ")",
              phone: customerPhoneClean,
              city: "طلب توفير خاص",
              district: "المساعد الذكي",
              addressDetails: "طلب الزبون توفير: " + requestedItemText,
              customerNote: "رسالة الزبون: \"" + input.request + "\" | رقم الزبون: " + customerPhoneClean,
              subtotal: 0,
              deliveryFee: 0,
              discount: 0,
              total: 0,
              status: "new",
            });
            const orderId = Number(inserted[0].insertId);
            await db.insert(orderItems).values({
              orderId,
              productId: null,
              productName: "🔔 مطلوب توفير: " + requestedItemText,
              productImage: null,
              unit: "طلب",
              unitPrice: 0,
              quantity: 1,
              lineTotal: 0,
            });
            await db.insert(orderEvents).values({
              orderId,
              status: "new",
              note: "طلب توفير تلقائي من المساعد الذكي — هاتف الزبون: " + customerPhoneClean,
              changedByUserId: null,
            });
            const subscriptions = await getAllAdminPushTargets(db);
            await deliverPushRows(subscriptions, {
              title: "🔔 طلب توفير منتج غير متوفر!",
              body: "طلب (" + requestedItemText + ") · هاتف الزبون: " + customerPhoneClean,
              url: "/admin/orders",
              tag: "shahezo-missing-item-" + orderId,
            }, async id => { await db.delete(ownerPushSubscriptions).where(eq(ownerPushSubscriptions.id, id)); });
          } catch (e) {
            console.warn("[Missing Item Notify Error]", e);
          }
        })();
      }

      return prepared;
    }),
  }),

  admin: router({
    // --- ADMIN_STAFF_ROUTER_START ---
    staff: router({
      list: requirePermission("staff.manage").query(async () => {
        const db = await database();
        await ensureRbacTables(db);
        const rows = await db.select().from(adminStaff).orderBy(desc(adminStaff.createdAt));
        const items = rows.map(row => {
          const roleKey = (ROLE_KEYS.includes(row.roleKey as any) ? row.roleKey : "staff") as AdminRoleKey;
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
            updatedAt: row.updatedAt,
          };
        });
        return {
          items,
          summary: {
            total: items.length,
            active: items.filter(i => i.isActive).length,
            disabled: items.filter(i => !i.isActive).length,
          },
        };
      }),
      auditLogs: requirePermission("staff.manage").query(async () => {
        const db = await database();
        await ensureRbacTables(db);
        return db.select().from(adminAuditLogs).orderBy(desc(adminAuditLogs.createdAt)).limit(250);
      }),
      create: requirePermission("staff.manage").input(z.object({
        displayName: z.string().trim().min(2).max(160),
        username: z.string().trim().min(3).max(120),
        password: z.string().min(6).max(128),
        roleKey: z.enum(["general_manager", "product_manager", "order_manager", "content_manager", "staff"]),
        permissions: z.array(z.enum(PERMISSION_KEYS)).max(30),
        allowedCategoryIds: z.array(z.number().int().positive()).max(100).optional(),
        mustChangePassword: z.boolean().default(true),
      })).mutation(async ({ ctx, input }) => {
        const normalizedUsername = input.username.trim().toLowerCase();
        if (["owner", "admin", "root"].includes(normalizedUsername)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "اسم المستخدم هذا محجوز لمالك المتجر." });
        }
        if (["123456", "12345678", "password", "admin123"].includes(input.password.trim().toLowerCase())) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "لا يُسمح باستخدام كلمة مرور ضعيفة أو افتراضية مثل 123456." });
        }
        const guard = canManageTargetStaff(
          { isOwner: ctx.user.isOwner, permissions: ctx.user.permissions, staffId: ctx.user.staffId },
          input.roleKey,
          input.permissions,
        );
        if (!guard.allowed) {
          throw new TRPCError({ code: "FORBIDDEN", message: guard.reason || "غير مسموح." });
        }
        const db = await database();
        await ensureRbacTables(db);
        const existing = await db.select({ id: adminStaff.id }).from(adminStaff).where(eq(adminStaff.username, normalizedUsername)).limit(1);
        if (existing.length > 0) {
          throw new TRPCError({ code: "CONFLICT", message: "اسم المستخدم أو البريد مسجل مسبقاً لمدير آخر." });
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
          createdBy: ctx.user.name || "مالك المتجر",
        });
        await writeAdminAuditLog({
          actorId: ctx.user.staffId ?? ctx.user.id,
          actorName: ctx.user.name || "مالك المتجر",
          actorRole: ctx.user.adminRole || "owner",
          action: "CREATE_STAFF",
          targetName: input.displayName + " (" + normalizedUsername + ")",
          details: "إنشاء حساب بدور: " + (ROLE_DEFINITIONS[input.roleKey]?.label || input.roleKey) + " | الصلاحيات: " + uniquePerms.map(p => PERMISSION_LABELS[p]?.label || p).join("، "),
          ipAddress: getClientIp(ctx.req),
        });
        return { id: Number(result[0].insertId), success: true };
      }),
      update: requirePermission("staff.manage").input(z.object({
        id: safeId,
        displayName: z.string().trim().min(2).max(160),
        username: z.string().trim().min(3).max(120),
        roleKey: z.enum(["general_manager", "product_manager", "order_manager", "content_manager", "staff"]),
        permissions: z.array(z.enum(PERMISSION_KEYS)).max(30),
        allowedCategoryIds: z.array(z.number().int().positive()).max(100).optional(),
      })).mutation(async ({ ctx, input }) => {
        const db = await database();
        await ensureRbacTables(db);
        const target = (await db.select().from(adminStaff).where(eq(adminStaff.id, input.id)).limit(1))[0];
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "الحساب الإداري غير موجود." });
        if (target.roleKey === "owner") throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكن تعديل حساب المالك." });
        const guard = canManageTargetStaff(
          { isOwner: ctx.user.isOwner, permissions: ctx.user.permissions, staffId: ctx.user.staffId },
          input.roleKey,
          input.permissions,
          target.id,
        );
        if (!guard.allowed) throw new TRPCError({ code: "FORBIDDEN", message: guard.reason || "غير مسموح." });
        const normalizedUsername = input.username.trim().toLowerCase();
        if (["owner", "admin", "root"].includes(normalizedUsername)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "اسم المستخدم هذا محجوز لمالك المتجر." });
        }
        const duplicateRows = await db.select({ id: adminStaff.id }).from(adminStaff).where(eq(adminStaff.username, normalizedUsername)).limit(5);
        const duplicate = duplicateRows.filter(r => r.id !== input.id);
        if (duplicate.length > 0) {
          throw new TRPCError({ code: "CONFLICT", message: "اسم المستخدم مستخدم بالفعل لحساب آخر." });
        }
        const uniquePerms = [...new Set(input.permissions)];
        await db.update(adminStaff).set({
          displayName: input.displayName.trim(),
          username: normalizedUsername,
          roleKey: input.roleKey,
          permissionsJson: serializePermissionsAndCategories(uniquePerms, input.allowedCategoryIds),
          sessionVersion: target.sessionVersion + 1,
        }).where(eq(adminStaff.id, input.id));
        await writeAdminAuditLog({
          actorId: ctx.user.staffId ?? ctx.user.id,
          actorName: ctx.user.name || "مالك المتجر",
          actorRole: ctx.user.adminRole || "owner",
          action: "UPDATE_STAFF",
          targetName: input.displayName + " (" + normalizedUsername + ")",
          details: "تحديث الدور إلى: " + (ROLE_DEFINITIONS[input.roleKey]?.label || input.roleKey) + " | الصلاحيات: " + uniquePerms.map(p => PERMISSION_LABELS[p]?.label || p).join("، "),
          ipAddress: getClientIp(ctx.req),
        });
        return { success: true };
      }),
      setStatus: requirePermission("staff.manage").input(z.object({
        id: safeId,
        isActive: z.boolean(),
      })).mutation(async ({ ctx, input }) => {
        const db = await database();
        await ensureRbacTables(db);
        const target = (await db.select().from(adminStaff).where(eq(adminStaff.id, input.id)).limit(1))[0];
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "الحساب الإداري غير موجود." });
        if (target.roleKey === "owner") throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكن تعطيل حساب مالك المتجر." });
        if (ctx.user.staffId && ctx.user.staffId === target.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك تعطيل حسابك الشخصي." });
        }
        if (!ctx.user.isOwner) {
          const targetPerms = parsePermissionsJson(target.permissionsJson, target.roleKey as AdminRoleKey);
          const guard = canManageTargetStaff({ isOwner: false, permissions: ctx.user.permissions, staffId: ctx.user.staffId }, target.roleKey as AdminRoleKey, targetPerms, target.id);
          if (!guard.allowed) throw new TRPCError({ code: "FORBIDDEN", message: guard.reason });
        }
        await db.update(adminStaff).set({
          isActive: input.isActive,
          sessionVersion: target.sessionVersion + 1,
        }).where(eq(adminStaff.id, input.id));
        await writeAdminAuditLog({
          actorId: ctx.user.staffId ?? ctx.user.id,
          actorName: ctx.user.name || "مالك المتجر",
          actorRole: ctx.user.adminRole || "owner",
          action: input.isActive ? "ACTIVATE_STAFF" : "DISABLE_STAFF",
          targetName: target.displayName + " (" + target.username + ")",
          details: input.isActive ? "تم تفعيل الحساب الإداري" : "تم تعطيل الحساب الإداري وإبطال جلسته الفورية",
          ipAddress: getClientIp(ctx.req),
        });
        return { success: true };
      }),
      resetPassword: requirePermission("staff.manage").input(z.object({
        id: safeId,
        newPassword: z.string().min(6).max(128),
        mustChangePassword: z.boolean().default(true),
      })).mutation(async ({ ctx, input }) => {
        if (["123456", "12345678", "password", "admin123"].includes(input.newPassword.trim().toLowerCase())) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "لا يُسمح بتعيين كلمة مرور ضعيفة أو افتراضية مثل 123456." });
        }
        const db = await database();
        await ensureRbacTables(db);
        const target = (await db.select().from(adminStaff).where(eq(adminStaff.id, input.id)).limit(1))[0];
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "الحساب الإداري غير موجود." });
        if (target.roleKey === "owner") throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكن إعادة تعيين كلمة مرور المالك من هنا." });
        if (!ctx.user.isOwner && ctx.user.staffId === target.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "استخدم نافذة تغيير كلمة المرور الخاصة بك." });
        }
        const passwordHash = hashAdminPassword(input.newPassword);
        await db.update(adminStaff).set({
          passwordHash,
          mustChangePassword: input.mustChangePassword,
          sessionVersion: target.sessionVersion + 1,
        }).where(eq(adminStaff.id, input.id));
        await writeAdminAuditLog({
          actorId: ctx.user.staffId ?? ctx.user.id,
          actorName: ctx.user.name || "مالك المتجر",
          actorRole: ctx.user.adminRole || "owner",
          action: "RESET_STAFF_PASSWORD",
          targetName: target.displayName + " (" + target.username + ")",
          details: "إعادة تعيين كلمة المرور" + (input.mustChangePassword ? " مع فرض تغييرها عند الدخول القادم" : ""),
          ipAddress: getClientIp(ctx.req),
        });
        return { success: true };
      }),
      delete: requirePermission("staff.manage").input(z.object({ id: safeId })).mutation(async ({ ctx, input }) => {
        if (!ctx.user.isOwner) {
          throw new TRPCError({ code: "FORBIDDEN", message: "حذف الحسابات الإدارية نهائياً متاح لمالك المتجر فقط؛ يمكنك تعطيل الحساب بدلاً من ذلك." });
        }
        const db = await database();
        await ensureRbacTables(db);
        const target = (await db.select().from(adminStaff).where(eq(adminStaff.id, input.id)).limit(1))[0];
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "الحساب غير موجود." });
        if (target.roleKey === "owner") throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكن حذف حساب المالك." });
        await db.update(users).set({ role: "user", suspended: true }).where(eq(users.openId, "staff_user_" + target.id));
        await db.delete(adminStaff).where(eq(adminStaff.id, input.id));
        await writeAdminAuditLog({
          actorId: ctx.user.id,
          actorName: ctx.user.name || "مالك المتجر",
          actorRole: "owner",
          action: "DELETE_STAFF",
          targetName: target.displayName + " (" + target.username + ")",
          details: "حذف الحساب الإداري نهائياً مع الحفاظ على سجلات الطلبات المرتبطة",
          ipAddress: getClientIp(ctx.req),
        });
        return { success: true };
      }),
      changeOwnPassword: protectedProcedure.input(z.object({
        currentPassword: z.string().min(1).max(128),
        newPassword: z.string().min(6).max(128),
      })).mutation(async ({ ctx, input }) => {
        if (!ctx.user.staffId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "تغيير كلمة مرور مالك المتجر يتم عبر متغير البيئة ADMIN_PASSWORD في الاستضافة." });
        }
        if (["123456", "12345678", "password", "admin123"].includes(input.newPassword.trim().toLowerCase())) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "يرجى اختيار كلمة مرور قوية وغير افتراضية." });
        }
        const db = await database();
        await ensureRbacTables(db);
        const staff = (await db.select().from(adminStaff).where(eq(adminStaff.id, ctx.user.staffId)).limit(1))[0];
        if (!staff || !verifyAdminPassword(input.currentPassword, staff.passwordHash)) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "كلمة المرور الحالية غير صحيحة." });
        }
        const nextVersion = staff.sessionVersion + 1;
        const passwordHash = hashAdminPassword(input.newPassword);
        await db.update(adminStaff).set({
          passwordHash,
          mustChangePassword: false,
          sessionVersion: nextVersion,
        }).where(eq(adminStaff.id, staff.id));
        const newToken = await sdk.createSessionToken("staff_" + staff.id + "_v" + nextVersion, {
          name: staff.displayName,
          expiresInMs: 7 * 24 * 60 * 60 * 1000,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, newToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
        await writeAdminAuditLog({
          actorId: staff.id,
          actorName: staff.displayName,
          actorRole: staff.roleKey,
          action: "CHANGE_OWN_PASSWORD",
          targetName: staff.username,
          details: "قام المدير بتحديث كلمة مروره المؤقتة بنجاح",
          ipAddress: getClientIp(ctx.req),
        });
        return { success: true };
      }),
    }),
    // --- ADMIN_STAFF_ROUTER_END ---
    chats: router({
      list: requirePermission("chats.manage").query(async () => {
        const db = await database();
        await loadLiveChats(db);
        return [...liveChatsMemory.values()].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      }),
      reply: requirePermission("chats.manage").input(z.object({
        sessionId: z.string().trim().min(1).max(80),
        text: z.string().trim().min(1).max(1200),
      })).mutation(async ({ input }) => {
        const db = await database();
        await loadLiveChats(db);
        const session = liveChatsMemory.get(input.sessionId);
        if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "المحادثة غير موجودة." });
        const msgObj: LiveChatMsg = {
          id: nanoid(10),
          role: "owner",
          sender: "إدارة المتجر",
          text: input.text.trim(),
          createdAt: new Date().toISOString(),
        };
        session.messages.push(msgObj);
        session.updatedAt = msgObj.createdAt;
        await saveLiveChats(db);
        return { success: true };
      }),
      toggleAi: requirePermission("chats.manage").input(z.object({
        sessionId: z.string().trim().min(1).max(80),
        aiPaused: z.boolean(),
      })).mutation(async ({ input }) => {
        const db = await database();
        await loadLiveChats(db);
        const session = liveChatsMemory.get(input.sessionId);
        if (session) {
          session.aiPaused = input.aiPaused;
          session.updatedAt = new Date().toISOString();
          await saveLiveChats(db);
        }
        return { success: true };
      }),
      delete: requirePermission("chats.manage").input(z.object({
        sessionId: z.string().trim().min(1).max(80),
      })).mutation(async ({ input }) => {
        const db = await database();
        await loadLiveChats(db);
        liveChatsMemory.delete(input.sessionId);
        await saveLiveChats(db);
        return { success: true };
      }),
    }),
    overview: requirePermission("overview.view").query(async () => getCached("admin:overview", 30_000, async () => {
      const db = await database();
      const [productRows, categoryRows, orderRows, customerRows, orderMetrics, settings] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(products),
        db.select({ count: sql<number>`count(*)` }).from(categories),
        db.select({ count: sql<number>`count(*)` }).from(orders),
        db.select({ count: sql<number>`count(distinct ${orders.phone})` }).from(orders).where(sql`${orders.phone} <> ''`),
        db.select({ orderValue: sql<number>`coalesce(sum(case when ${orders.status} <> 'cancelled' then ${orders.total} else 0 end), 0)`, openOrders: sql<number>`coalesce(sum(case when ${orders.status} in ('new', 'preparing', 'ready', 'out_for_delivery') then 1 else 0 end), 0)` }).from(orders),
        readSettings(db),
      ]);
      const recentOrders = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(6);
      return { products: Number(productRows[0]?.count ?? 0), categories: Number(categoryRows[0]?.count ?? 0), orders: Number(orderRows[0]?.count ?? 0), customers: Number(customerRows[0]?.count ?? 0), orderValue: Number(orderMetrics[0]?.orderValue ?? 0), openOrders: Number(orderMetrics[0]?.openOrders ?? 0), recentOrders, settings };
    })),
    notifications: router({
      subscribe: adminProcedure.input(pushSubscriptionSchema).mutation(async ({ ctx, input }) => {
        if (!isAllowedPushEndpoint(input.endpoint)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "خدمة الإشعارات في هذا المتصفح غير مدعومة." });
        }
        const db = await database();
        const protectedSubscription = protectPushSubscription(input);
        await saveBackupAdminSubscription(db, protectedSubscription);
        let userId = ctx.user.id;
        if (!userId || userId <= 0) {
          const openId = ctx.user.openId || ("staff_user_" + (ctx.user.staffId || "admin"));
          await db.insert(users).values({ openId, name: ctx.user.name || "إدارة المتجر", role: "admin", loginMethod: "staff_password" })
            .onDuplicateKeyUpdate({ set: { updatedAt: new Date() } }).catch(() => {});
          const uRows = await db.select({ id: users.id }).from(users).where(eq(users.openId, openId)).limit(1).catch(() => []);
          if (uRows[0]?.id) userId = uRows[0].id;
        }
        if (userId && userId > 0) {
          await db.insert(ownerPushSubscriptions).values({ userId, ...protectedSubscription })
            .onDuplicateKeyUpdate({ set: { encryptedPayload: protectedSubscription.encryptedPayload, updatedAt: new Date() } }).catch(() => {});
        }
        return { success: true };
      }),
      testPush: adminProcedure.mutation(async () => {
        const db = await database();
        const targets = await getAllAdminPushTargets(db);
        if (!targets.length) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "يرجى الضغط على زر تفعيل الإشعارات أولاً لربط هذا الجهاز." });
        }
        await deliverPushRows(targets, {
          title: "🥙 إدارة شهيزو · الإشعارات نشطة",
          body: "جهازك مربوط بنجاح! سيصلك إشعار فوري وأنيق مع كل طلب جديد حتى لو كان التطبيق مغلقاً ✨",
          url: "/admin/orders",
          tag: "shahezo-admin-test-push",
        }, async (id, endpointHash) => {
          if (id > 0) await db.delete(ownerPushSubscriptions).where(eq(ownerPushSubscriptions.id, id)).catch(() => {});
          if (endpointHash) await removeBackupAdminSubscription(db, endpointHash);
        });
        return { sent: targets.length };
      }),
    }),
    products: router({
      list: requireAnyPermission(["products.view", "products.add", "products.edit", "products.delete", "products.manage", "inventory.manage"]).query(async ({ ctx }) => {
        const db = await database();
        const allowedCats = (!ctx.user.isOwner && Array.isArray(ctx.user.allowedCategoryIds) && ctx.user.allowedCategoryIds.length > 0) ? ctx.user.allowedCategoryIds : null;
        const rows = allowedCats
          ? await db.select().from(products).where(inArray(products.categoryId, allowedCats)).orderBy(desc(products.updatedAt)).limit(500)
          : await db.select().from(products).orderBy(desc(products.updatedAt)).limit(500);
        return rows.map(r => toFastImg("product", r));
      }),
      create: requireAnyPermission(["products.manage", "products.add"]).use(async ({ next }) => { const res = await next(); clearCatalogCache(); return res; }).input(productInput).mutation(async ({ ctx, input }) => {
        const allowedCats = (!ctx.user.isOwner && Array.isArray(ctx.user.allowedCategoryIds) && ctx.user.allowedCategoryIds.length > 0) ? ctx.user.allowedCategoryIds : null;
        if (allowedCats && (!input.categoryId || !allowedCats.includes(input.categoryId))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "صلاحيتك مخصصة لإدارة أقسام محددة فقط؛ اختر قسماً ضمن صلاحياتك." });
        }
        const db = await database();
        const result = await db.insert(products).values({ ...input, slug: slugify(input.name), description: input.description ?? null, imageUrl: input.imageUrl ?? null, categoryId: input.categoryId ?? null, stock: input.stock ?? null });
        void (async () => {
          try {
            const allRows = await db.select({ id: products.id, name: products.name, description: products.description, price: products.price, unit: products.unit, stock: products.stock, minQuantity: products.minQuantity, quantityStep: products.quantityStep }).from(products).where(and(eq(products.isPublished, true), eq(products.isAvailable, true))).limit(60);
            await generateAndCacheProductAiRecipe(input.name, allRows as AssistantCatalogProduct[]);
          } catch {}
        })();
        return { id: Number(result[0].insertId) };
      }),
      update: requireAnyPermission(["products.manage", "products.edit", "inventory.manage"]).use(async ({ next }) => { const res = await next(); clearCatalogCache(); return res; }).input(z.object({ id: safeId, values: productInput.partial() })).mutation(async ({ ctx, input }) => {
        const canEditProduct = hasPermission(ctx.user.permissions, ctx.user.isOwner, "products.edit") || hasPermission(ctx.user.permissions, ctx.user.isOwner, "products.manage");
        if (!canEditProduct) {
          const allowedKeys = new Set(["price", "stock", "isAvailable", "minQuantity", "quantityStep"]);
          for (const k of Object.keys(input.values)) {
            if (!allowedKeys.has(k)) throw new TRPCError({ code: "FORBIDDEN", message: "صلاحيتك تقتصر على تحديث السعر والمخزون والتوفر فقط." });
          }
        }
        const db = await database();
        const allowedCats = (!ctx.user.isOwner && Array.isArray(ctx.user.allowedCategoryIds) && ctx.user.allowedCategoryIds.length > 0) ? ctx.user.allowedCategoryIds : null;
        if (allowedCats) {
          const target = (await db.select({ categoryId: products.categoryId }).from(products).where(eq(products.id, input.id)).limit(1))[0];
          if (!target || !target.categoryId || !allowedCats.includes(target.categoryId)) {
            throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك تعديل منتج خارج الأقسام المخصصة لك." });
          }
          if (input.values.categoryId !== undefined && (!input.values.categoryId || !allowedCats.includes(input.values.categoryId))) {
            throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك نقل المنتج إلى قسم خارج صلاحياتك." });
          }
        }
        const cleanVals = { ...input.values }; if (typeof cleanVals.imageUrl === "string" && cleanVals.imageUrl.startsWith("/api/fast-img/")) delete cleanVals.imageUrl; (globalThis as any).__fastImgCache?.delete("product:" + input.id); await db.update(products).set(cleanVals).where(eq(products.id, input.id));
        return { success: true };
      }),
      bulkAdjustPrices: requireAnyPermission(["products.manage", "products.edit", "inventory.manage"]).use(async ({ next }) => { const res = await next(); clearCatalogCache(); return res; }).input(z.object({
        categoryId: z.number().int().positive().nullable().optional(),
        mode: z.enum(["percent", "fixed"]),
        amount: z.number().min(-90).max(1000000),
        roundTo50: z.boolean().default(true),
      })).mutation(async ({ ctx, input }) => {
        const db = await database();
        const allowedCats = (!ctx.user.isOwner && Array.isArray(ctx.user.allowedCategoryIds) && ctx.user.allowedCategoryIds.length > 0) ? ctx.user.allowedCategoryIds : null;
        if (allowedCats && input.categoryId && !allowedCats.includes(input.categoryId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية لتعديل أسعار هذا القسم." });
        }
        const allRows = await db.select({ id: products.id, price: products.price, categoryId: products.categoryId }).from(products);
        const targets = allRows.filter(r => {
          if (allowedCats && (!r.categoryId || !allowedCats.includes(r.categoryId))) return false;
          if (input.categoryId && r.categoryId !== input.categoryId) return false;
          return true;
        });
        let updatedCount = 0;
        for (const row of targets) {
          let nextPrice = input.mode === "percent"
            ? Math.round(row.price * (1 + input.amount / 100))
            : Math.round(row.price + input.amount);
          if (input.roundTo50 && nextPrice > 100) {
            nextPrice = Math.round(nextPrice / 50) * 50;
          }
          nextPrice = Math.max(50, nextPrice);
          if (nextPrice !== row.price) {
            await db.update(products).set({ price: nextPrice }).where(eq(products.id, row.id));
            updatedCount++;
          }
        }
        return { updatedCount };
      }),
      archive: requireAnyPermission(["products.manage", "products.edit", "products.delete"]).use(async ({ next }) => { const res = await next(); clearCatalogCache(); return res; }).input(z.object({ id: safeId })).mutation(async ({ ctx, input }) => {
        const db = await database();
        const allowedCats = (!ctx.user.isOwner && Array.isArray(ctx.user.allowedCategoryIds) && ctx.user.allowedCategoryIds.length > 0) ? ctx.user.allowedCategoryIds : null;
        if (allowedCats) {
          const target = (await db.select({ categoryId: products.categoryId }).from(products).where(eq(products.id, input.id)).limit(1))[0];
          if (!target || !target.categoryId || !allowedCats.includes(target.categoryId)) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك تعديل منتج خارج الأقسام المخصصة لك." });
        }
        await db.update(products).set({ isPublished: false, isAvailable: false }).where(eq(products.id, input.id));
        clearCatalogCache(input.id);
        return { success: true };
      }),
      // --- PRODUCT_DELETE_ENDPOINT ---
      delete: requireAnyPermission(["products.manage", "products.delete"]).use(async ({ next }) => { const res = await next(); clearCatalogCache(); return res; }).input(z.object({ id: safeId })).mutation(async ({ ctx, input }) => {
        const db = await database();
        const allowedCats = (!ctx.user.isOwner && Array.isArray(ctx.user.allowedCategoryIds) && ctx.user.allowedCategoryIds.length > 0) ? ctx.user.allowedCategoryIds : null;
        if (allowedCats) {
          const target = (await db.select({ categoryId: products.categoryId }).from(products).where(eq(products.id, input.id)).limit(1))[0];
          if (!target || !target.categoryId || !allowedCats.includes(target.categoryId)) {
            throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك حذف منتج خارج الأقسام المخصصة لك." });
          }
        }
        (globalThis as any).__fastImgCache?.delete("product:" + input.id);
        await db.transaction(async tx => {
          await tx.delete(productRecommendations).where(or(eq(productRecommendations.productId, input.id), eq(productRecommendations.recommendedProductId, input.id)));
          await tx.delete(favorites).where(eq(favorites.productId, input.id));
          await tx.update(orderItems).set({ productId: null }).where(eq(orderItems.productId, input.id));
          await tx.delete(products).where(eq(products.id, input.id));
        });
        clearCatalogCache(input.id);
        return { success: true };
      }),
      analyzeImage: requireAnyPermission(["products.manage", "products.add", "products.edit"])
        .input(z.object({ imageDataUrl: z.string().min(20).max(2_500_000), fileName: z.string().max(200).optional() }))
        .mutation(async ({ ctx, input }) => {
          const db = await database();
          let catRows = await db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.sortOrder));
          const allowedCats = (!ctx.user.isOwner && Array.isArray(ctx.user.allowedCategoryIds) && ctx.user.allowedCategoryIds.length > 0) ? ctx.user.allowedCategoryIds : null;
          if (allowedCats) catRows = catRows.filter(c => allowedCats.includes(c.id));
          const res = await analyzeProductImageAI({ imageDataUrl: input.imageDataUrl, fileName: input.fileName, categories: catRows });
          if (allowedCats && (!res.categoryId || !allowedCats.includes(res.categoryId))) {
            res.categoryId = allowedCats[0] ?? null;
          } else if (!res.categoryId && res.suggestedCategoryName && !allowedCats) {
            const existing = catRows.find(c => c.name.trim() === res.suggestedCategoryName!.trim());
            if (existing) {
              res.categoryId = existing.id;
            } else {
              try {
                const ins = await db.insert(categories).values({
                  name: res.suggestedCategoryName,
                  slug: slugify(res.suggestedCategoryName),
                  description: "قسم " + res.suggestedCategoryName,
                  imageUrl: null,
                  isActive: true,
                  sortOrder: catRows.length,
                });
                const newId = Number(ins[0]?.insertId || 0);
                if (newId > 0) {
                  res.categoryId = newId;
                  clearCatalogCache();
                }
              } catch {}
            }
          }
          return res;
        }),
      parseBulkText: requireAnyPermission(["products.manage", "products.add", "products.edit"])
        .input(z.object({ rawText: z.string().min(2).max(12000) }))
        .mutation(async ({ ctx, input }) => {
          const db = await database();
          let catRows = await db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.sortOrder));
          const allowedCats = (!ctx.user.isOwner && Array.isArray(ctx.user.allowedCategoryIds) && ctx.user.allowedCategoryIds.length > 0) ? ctx.user.allowedCategoryIds : null;
          if (allowedCats) catRows = catRows.filter(c => allowedCats.includes(c.id));
          return parseBulkProductsTextAI({ rawText: input.rawText, categories: catRows });
        }),
      bulkCreate: requireAnyPermission(["products.manage", "products.add"])
        .use(async ({ next }) => { const res = await next(); clearCatalogCache(); return res; })
        .input(z.object({ items: z.array(productInput).min(1).max(60) }))
        .mutation(async ({ ctx, input }) => {
          const db = await database();
          const allowedCats = (!ctx.user.isOwner && Array.isArray(ctx.user.allowedCategoryIds) && ctx.user.allowedCategoryIds.length > 0) ? ctx.user.allowedCategoryIds : null;
          const insertedIds: number[] = [];
          for (const item of input.items) {
            const effectiveCatId = allowedCats
              ? (item.categoryId && allowedCats.includes(item.categoryId) ? item.categoryId : allowedCats[0])
              : (item.categoryId ?? null);
            const result = await db.insert(products).values({
              ...item,
              slug: slugify(item.name),
              description: item.description ?? null,
              imageUrl: item.imageUrl ?? null,
              categoryId: effectiveCatId,
              stock: item.stock ?? null,
            });
            insertedIds.push(Number(result[0]?.insertId || 0));
          }
          return { count: insertedIds.length, ids: insertedIds };
        }),
      setRecommendations: requireAnyPermission(["products.manage", "products.edit"]).input(z.object({ productId: safeId, recommendedIds: z.array(safeId).max(30) })).mutation(async ({ input }) => {
        if (input.recommendedIds.includes(input.productId)) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن اقتراح المنتج نفسه." });
        const db = await database();
        await db.transaction(async tx => {
          await tx.delete(productRecommendations).where(eq(productRecommendations.productId, input.productId));
          if (input.recommendedIds.length) await tx.insert(productRecommendations).values(input.recommendedIds.map(recommendedProductId => ({ productId: input.productId, recommendedProductId })));
        });
        return { success: true };
      }),
    }),
    categories: router({
      // --- CATEGORY_DELETE_ENDPOINT ---
      delete: requirePermission("categories.manage").use(async ({ next }) => { clearCatalogCache(); return next(); }).input(z.object({ id: safeId })).mutation(async ({ input }) => {
        const db = await database();
        await db.transaction(async tx => {
          await tx.update(products).set({ categoryId: null }).where(eq(products.categoryId, input.id));
          await tx.delete(categories).where(eq(categories.id, input.id));
        });
        return { success: true };
      }),
      list: requireAnyPermission(["categories.manage", "products.view", "products.add", "products.edit", "products.manage"]).query(async () => getCached("admin:categories", 30_000, async () => {
        const db = await database();
        const rows = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.id)); return rows.map(r => toFastImg("category", r));
      })),
      create: adminProcedure.use(async ({ next }) => { clearLiveHomeCache(); return next(); }).input(categoryInput).mutation(async ({ input }) => {
        const db = await database();
        const result = await db.insert(categories).values({ ...input, slug: slugify(input.name), description: input.description ?? null, imageUrl: input.imageUrl ?? null });
        clearCatalogCache(); return { id: Number(result[0].insertId) };
      }),
      update: adminProcedure.use(async ({ next }) => { clearLiveHomeCache(); return next(); }).input(z.object({ id: safeId, values: categoryInput.partial() })).mutation(async ({ input }) => {
        const db = await database();
        const cleanCatVals = { ...input.values }; if (typeof cleanCatVals.imageUrl === "string" && cleanCatVals.imageUrl.startsWith("/api/fast-img/")) delete cleanCatVals.imageUrl; (globalThis as any).__fastImgCache?.delete("category:" + input.id); await db.update(categories).set(cleanCatVals).where(eq(categories.id, input.id));
        clearCatalogCache(); return { success: true };
      }),
      archive: adminProcedure.use(async ({ next }) => { clearLiveHomeCache(); return next(); }).input(z.object({ id: safeId })).mutation(async ({ input }) => {
        const db = await database();
        await db.update(categories).set({ isActive: false }).where(eq(categories.id, input.id));
        clearCatalogCache(); return { success: true };
      }),
    }),
    banners: router({
      list: requirePermission("banners.manage").query(async () => {
        const db = await database();
        const rows = await db.select().from(banners).orderBy(asc(banners.sortOrder), desc(banners.createdAt)); return rows.map(r => toFastImg("banner", r));
      }),
      create: requirePermission("banners.manage").use(async ({ next }) => { clearLiveHomeCache(); return next(); }).input(z.object({ title: z.string().trim().min(1).max(160), body: z.string().trim().max(1000).optional(), imageUrl: z.string().max(8500000).optional(), actionText: z.string().trim().max(60).optional(), actionUrl: z.string().trim().max(2000).optional(), isActive: z.boolean().default(false), sortOrder: z.number().int().min(-10000).max(10000).default(0) })).mutation(async ({ input }) => {
        const db = await database();
        const result = await db.insert(banners).values({ ...input, body: input.body ?? null, imageUrl: input.imageUrl ?? null, actionText: input.actionText ?? null, actionUrl: input.actionUrl ?? null });
        clearCatalogCache(); return { id: Number(result[0].insertId) };
      }),
      update: requirePermission("banners.manage").use(async ({ next }) => { clearLiveHomeCache(); return next(); }).input(z.object({ id: safeId, values: z.object({ title: z.string().trim().min(1).max(160).optional(), body: z.string().max(1000).nullable().optional(), imageUrl: z.string().max(8500000).nullable().optional(), actionText: z.string().max(60).nullable().optional(), actionUrl: z.string().max(2000).nullable().optional(), isActive: z.boolean().optional(), sortOrder: z.number().int().min(-10000).max(10000).optional() }) })).mutation(async ({ input }) => {
        const db = await database();
        const cleanBanVals = { ...input.values }; if (typeof cleanBanVals.imageUrl === "string" && cleanBanVals.imageUrl.startsWith("/api/fast-img/")) delete cleanBanVals.imageUrl; (globalThis as any).__fastImgCache?.delete("banner:" + input.id); await db.update(banners).set(cleanBanVals).where(eq(banners.id, input.id));
        clearCatalogCache(); return { success: true };
      }),
      delete: adminProcedure.input(z.object({ id: safeId })).mutation(async ({ input }) => {
        const db = await database();
        await db.delete(banners).where(eq(banners.id, input.id));
        clearCatalogCache(); return { success: true };
      }),
    }),
    offers: router({
      list: requirePermission("offers.manage").query(async () => {
        const db = await database();
        return db.select().from(offers).orderBy(desc(offers.createdAt));
      }),
      create: requirePermission("offers.manage").use(async ({ next }) => { clearLiveHomeCache(); return next(); }).input(z.object({
        title: z.string().trim().min(1).max(160),
        description: z.string().trim().max(1000).nullable().optional(),
        code: z.string().trim().min(1).max(40),
        discountType: z.enum(["fixed", "percent"]),
        discountValue: z.number().int().min(1).max(100000000),
        minimumOrder: z.number().int().min(0).max(100000000).default(0),
        startsAt: z.string().nullable().optional(),
        endsAt: z.string().nullable().optional(),
        isActive: z.boolean().default(true),
      })).mutation(async ({ input }) => {
        if (input.discountType === "percent" && input.discountValue > 100) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "نسبة الخصم يجب ألا تتجاوز 100%." });
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
          isActive: input.isActive,
        };
        const result = await db.insert(offers).values(values).onDuplicateKeyUpdate({ set: values });
        clearCatalogCache();
        return { id: Number(result[0].insertId || 1) };
      }),
      update: requirePermission("offers.manage").use(async ({ next }) => { clearLiveHomeCache(); return next(); }).input(z.object({
        id: safeId,
        values: z.object({
          title: z.string().trim().min(1).max(160).optional(),
          description: z.string().max(1000).nullable().optional(),
          code: z.string().trim().min(1).max(40).optional(),
          discountType: z.enum(["fixed", "percent"]).optional(),
          discountValue: z.number().int().min(1).max(100000000).optional(),
          minimumOrder: z.number().int().min(0).max(100000000).optional(),
          startsAt: z.string().nullable().optional(),
          endsAt: z.string().nullable().optional(),
          isActive: z.boolean().optional(),
        }),
      })).mutation(async ({ input }) => {
        if (input.values.discountType === "percent" && input.values.discountValue !== undefined && input.values.discountValue > 100) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "نسبة الخصم يجب ألا تتجاوز 100%." });
        }
        const db = await database();
        await db.update(offers).set({
          ...input.values,
          code: input.values.code?.trim().toUpperCase(),
          startsAt: input.values.startsAt === undefined ? undefined : input.values.startsAt === null || input.values.startsAt === "" ? null : new Date(input.values.startsAt),
          endsAt: input.values.endsAt === undefined ? undefined : input.values.endsAt === null || input.values.endsAt === "" ? null : new Date(input.values.endsAt),
        }).where(eq(offers.id, input.id));
        clearCatalogCache();
        return { success: true };
      }),
      delete: adminProcedure.input(z.object({ id: safeId })).mutation(async ({ input }) => {
        const db = await database();
        await db.delete(offers).where(eq(offers.id, input.id));
        clearCatalogCache();
        return { success: true };
      }),
    }),
    settings: router({
      get: requireAnyPermission(["settings.manage", "overview.view"]).query(async () => readSettings(await database())),
      save: requirePermission("settings.manage").input(settingSchema).mutation(async ({ input }) => { clearCatalogCache();
        const db = await database();
        await db.transaction(async tx => {
          for (const [key, value] of Object.entries(input)) {
            const stored = value === null ? "" : typeof value === "string" ? value : JSON.stringify(value);
            await tx.insert(storeSettings).values({ key, value: stored }).onDuplicateKeyUpdate({ set: { value: stored } });
          }
        });
        clearCatalogCache(); return { success: true };
      }),
    }),
    orders: router({
      // --- ORDER_DELETE_ENDPOINT ---
      delete: requirePermission("orders.manage").use(async ({ next }) => { clearCatalogCache(); return next(); }).input(z.object({ id: safeId })).mutation(async ({ input }) => {
        const db = await database();
        await db.transaction(async tx => {
          await tx.delete(customerPushSubscriptions).where(eq(customerPushSubscriptions.orderId, input.id));
          await tx.delete(orderEvents).where(eq(orderEvents.orderId, input.id));
          await tx.delete(orderItems).where(eq(orderItems.orderId, input.id));
          await tx.delete(orders).where(eq(orders.id, input.id));
        });
        return { success: true };
      }),
      createdAfter: adminProcedure.input(z.object({ afterId: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) })).query(async ({ input }) => getCached("createdAfter:" + input.afterId, 10_000, async () => {
        const db = await database();
        if (input.afterId === 0) {
          const latest = (await db.select({ id: orders.id }).from(orders).orderBy(desc(orders.id)).limit(1))[0];
          return { latestId: latest?.id ?? 0, orders: [] };
        }
        const rows = await db.select({ id: orders.id, orderNumber: orders.orderNumber, createdAt: orders.createdAt })
          .from(orders).where(gt(orders.id, input.afterId)).orderBy(asc(orders.id)).limit(25);
        return { latestId: rows.at(-1)?.id ?? input.afterId, orders: rows };
      })),
      list: requireAnyPermission(["orders.view", "orders.manage"]).query(async () => {
        const db = await database();
        const rows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(500);
        if (!rows.length) return [];
        const ids = rows.map(order => sql`${order.id}`);
        const [items, events] = await Promise.all([
          db.select().from(orderItems).where(sql`${orderItems.orderId} in (${sql.join(ids, sql`, `)})`),
          db.select().from(orderEvents).where(sql`${orderEvents.orderId} in (${sql.join(ids, sql`, `)})`).orderBy(asc(orderEvents.createdAt)),
        ]);
        return rows.map(order => ({ ...order, items: items.filter(item => item.orderId === order.id), events: events.filter(event => event.orderId === order.id) }));
      }),
      removeItem: requirePermission("orders.manage").use(async ({ next }) => { const res = await next(); clearCatalogCache(); return res; }).input(z.object({
        orderId: safeId,
        itemId: safeId,
        cancelQty: z.number().int().min(1).max(1000).optional(),
        reason: z.string().trim().min(1).max(400),
      })).mutation(async ({ ctx, input }) => {
        const db = await database();
        const result = await db.transaction(async tx => {
          const ord = (await tx.select().from(orders).where(eq(orders.id, input.orderId)).limit(1).for("update"))[0];
          if (!ord) throw new TRPCError({ code: "NOT_FOUND", message: "لم يتم العثور على الطلب." });
          if (ord.status === "delivered" || ord.status === "cancelled") {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن تعديل أصناف طلب تم تسليمه أو إلغاؤه بالكامل." });
          }
          const allItems = await tx.select().from(orderItems).where(eq(orderItems.orderId, input.orderId));
          const targetItem = allItems.find(it => it.id === input.itemId);
          if (!targetItem) throw new TRPCError({ code: "NOT_FOUND", message: "الصنف غير موجود في هذه الفاتورة." });
          const qtyToCancel = input.cancelQty ? Math.min(targetItem.quantity, input.cancelQty) : targetItem.quantity;
          const isFullCancel = qtyToCancel >= targetItem.quantity;
          const deductedAmount = isFullCancel ? targetItem.lineTotal : Math.round(targetItem.unitPrice * qtyToCancel);
          if (targetItem.productId !== null) {
            const prod = (await tx.select({ stock: products.stock }).from(products).where(eq(products.id, targetItem.productId)).limit(1).for("update"))[0];
            if (prod && prod.stock !== null) {
              await tx.update(products).set({ stock: prod.stock + qtyToCancel }).where(eq(products.id, targetItem.productId));
            }
          }
          if (isFullCancel) {
            await tx.delete(orderItems).where(eq(orderItems.id, targetItem.id));
          } else {
            const remainQty = targetItem.quantity - qtyToCancel;
            const remainLineTotal = Math.max(0, targetItem.lineTotal - deductedAmount);
            await tx.update(orderItems).set({ quantity: remainQty, lineTotal: remainLineTotal }).where(eq(orderItems.id, targetItem.id));
          }
          const updatedItems = await tx.select().from(orderItems).where(eq(orderItems.orderId, input.orderId));
          const newSubtotal = updatedItems.reduce((sum, it) => sum + Number(it.lineTotal || 0), 0);
          const newStatus = updatedItems.length === 0 ? "cancelled" : ord.status;
          const newDeliveryFee = updatedItems.length === 0 ? 0 : ord.deliveryFee;
          const newTotal = updatedItems.length === 0 ? 0 : Math.max(0, newSubtotal + newDeliveryFee - Number(ord.discount || 0));
          await tx.update(orders).set({ subtotal: newSubtotal, deliveryFee: newDeliveryFee, total: newTotal, status: newStatus }).where(eq(orders.id, input.orderId));
          const auditNote = isFullCancel
            ? ("❌ إلغاء صنف من الفاتورة: «" + targetItem.productName + "» (الكمية: " + qtyToCancel + " · خُصم: " + deductedAmount + " ر.ي) — التوضيح للعميل: " + input.reason + " | الإجمالي الجديد: " + newTotal + " ر.ي")
            : ("❌ تعديل كمية صنف: «" + targetItem.productName + "» (أُلغي " + qtyToCancel + " وبقي " + (targetItem.quantity - qtyToCancel) + " · خُصم: " + deductedAmount + " ر.ي) — التوضيح للعميل: " + input.reason + " | الإجمالي الجديد: " + newTotal + " ر.ي");
          await tx.insert(orderEvents).values({
            orderId: input.orderId,
            status: newStatus,
            note: auditNote,
            changedByUserId: ctx.user.id,
          });
          return { orderNumber: ord.orderNumber, newStatus, newTotal, deductedAmount, itemName: targetItem.productName, customerNotice: "تحديث بخصوص طلبك " + ord.orderNumber + ": تم إلغاء «" + targetItem.productName + "» (" + input.reason + ") وخصم " + deductedAmount + " ر.ي من الفاتورة. الإجمالي الجديد: " + newTotal + " ر.ي" };
        });
        void notifyCustomerOrderStatus(input.orderId, result.orderNumber, result.newStatus, result.customerNotice).catch(() => {});
        return result;
      }),
      sendNote: requirePermission("orders.manage").input(z.object({ id: safeId, note: z.string().trim().min(1).max(500) })).mutation(async ({ ctx, input }) => {
        const db = await database();
        const current = (await db.select({ id: orders.id, status: orders.status, orderNumber: orders.orderNumber }).from(orders).where(eq(orders.id, input.id)).limit(1))[0];
        if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "لم يتم العثور على الطلب." });
        await db.insert(orderEvents).values({ orderId: input.id, status: current.status, note: input.note, changedByUserId: ctx.user.id > 0 ? ctx.user.id : null });
        await notifyCustomerOrderStatus(input.id, current.orderNumber, current.status, input.note);
        return { success: true };
      }),
      setStatus: requirePermission("orders.manage").input(z.object({ id: safeId, status: orderStatus, note: z.string().trim().max(500).optional() })).mutation(async ({ ctx, input }) => {
        const db = await database();
        const orderNumber = await db.transaction(async tx => {
          const current = (await tx.select({ id: orders.id, status: orders.status, orderNumber: orders.orderNumber }).from(orders).where(eq(orders.id, input.id)).limit(1).for("update"))[0];
          if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "لم يتم العثور على الطلب." });
          if (current.status === "delivered" || current.status === "cancelled") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يمكن تغيير حالة طلب مغلق." });
          const allowed: Record<string, string[]> = { new: ["preparing", "cancelled"], preparing: ["ready", "cancelled"], ready: ["out_for_delivery", "cancelled"], out_for_delivery: ["delivered"] };
          if (!allowed[current.status]?.includes(input.status)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: current.status === "out_for_delivery" && input.status === "cancelled" ? "لا يمكن إلغاء الطلب بعد خروجه للتوصيل؛ عالجه عبر إجراء إرجاع بعد استلامه." : "اتبع تسلسل حالات الطلب: جديد، تجهيز، جاهز، توصيل، ثم تسليم؛ أو ألغِ الطلب قبل خروجه." });
          if (input.status === "cancelled") {
            const lines = await tx.select({ productId: orderItems.productId, quantity: orderItems.quantity }).from(orderItems).where(eq(orderItems.orderId, input.id));
            for (const line of lines) {
              if (line.productId === null) continue;
              const product = (await tx.select({ stock: products.stock }).from(products).where(eq(products.id, line.productId)).limit(1).for("update"))[0];
              if (product && product.stock !== null) await tx.update(products).set({ stock: product.stock + line.quantity }).where(eq(products.id, line.productId));
            }
          }
          await tx.update(orders).set({ status: input.status }).where(eq(orders.id, input.id));
          await tx.insert(orderEvents).values({ orderId: input.id, status: input.status, note: input.note ?? null, changedByUserId: null });
          return current.orderNumber;
        });
        void notifyCustomerOrderStatus(input.id, orderNumber, input.status, input.note)
          .catch(() => console.warn("[Push] Could not notify customer of an order update"));
        clearCatalogCache(); return { success: true };
      }),
    }),
    customers: router({
      list: requirePermission("customers.view").query(async () => {
        const db = await database();
        return db.select({
          phone: orders.phone,
          orderCount: sql<number>`count(*)`,
          totalSpent: sql<number>`coalesce(sum(case when ${orders.status} <> 'cancelled' then ${orders.total} else 0 end), 0)`,
          lastOrderAt: sql<Date>`max(${orders.createdAt})`,
        }).from(orders).where(sql`${orders.phone} <> ''`).groupBy(orders.phone).orderBy(desc(sql`max(${orders.createdAt})`)).limit(500);
      }),
    }),
    users: router({
      list: requirePermission("customers.view").query(async () => {
        const db = await database();
        const rows = await db.select({ id: users.id, name: users.name, email: users.email, phone: users.phone, role: users.role, suspended: users.suspended, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn }).from(users).orderBy(desc(users.createdAt)).limit(1000);
        if (!rows.length) return [];
        const ids = rows.map(user => user.id);
        const [stats, savedAddresses] = await Promise.all([
          db.select({ userId: orders.userId, orderCount: sql<number>`count(*)`, totalSpent: sql<number>`coalesce(sum(case when ${orders.status} <> 'cancelled' then ${orders.total} else 0 end), 0)` }).from(orders).where(inArray(orders.userId, ids)).groupBy(orders.userId),
          db.select({ userId: addresses.userId, id: addresses.id, label: addresses.label, recipientName: addresses.recipientName, phone: addresses.phone, city: addresses.city, district: addresses.district, details: addresses.details, isDefault: addresses.isDefault }).from(addresses).where(inArray(addresses.userId, ids)).orderBy(desc(addresses.isDefault), desc(addresses.id)),
        ]);
        return rows.map(user => {
          const stat = stats.find(row => row.userId === user.id);
          return { ...user, orderCount: Number(stat?.orderCount ?? 0), totalSpent: Number(stat?.totalSpent ?? 0), addresses: savedAddresses.filter(address => address.userId === user.id) };
        });
      }),
      setSuspended: requirePermission("staff.manage").input(z.object({ id: safeId, suspended: z.boolean() })).mutation(async ({ ctx, input }) => {
        const db = await database();
        const target = (await db.select({ id: users.id, role: users.role, openId: users.openId }).from(users).where(eq(users.id, input.id)).limit(1))[0];
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "الحساب غير موجود." });
        if (target.id === ctx.user.id || target.role === "admin") throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكن حظر حساب مالك/مدير." });
        await db.update(users).set({ suspended: input.suspended }).where(eq(users.id, input.id));
        clearCatalogCache(); return { success: true };
      }),
    }),
    uploadImage: requireAnyPermission(["products.manage", "products.add", "products.edit", "categories.manage", "banners.manage", "settings.manage"]).input(z.object({ dataUrl: z.string().min(30).max(8_500_000), kind: z.enum(["product", "category", "banner", "icon"]) })).mutation(async ({ input }) => {
      const match = input.dataUrl.match(/^data:(image\/(?:webp|png|jpeg));base64,([A-Za-z0-9+/=]+)$/);
      if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "صيغة الصورة غير مدعومة. استخدم WEBP أو PNG أو JPEG." });
      return { imageUrl: input.dataUrl };
    }),
  }),
});


// Pre-warm catalog cache on startup and every 45s in background
async function __prewarmCatalog() {
  try {
    const caller = commerceRouter.createCaller({ req: { headers: {}, ip: "127.0.0.1" } as any, res: {} as any, user: null });
    await Promise.allSettled([
      caller.catalog.home(),
      caller.catalog.listCategories(),
      caller.catalog.listProducts({ sort: "featured", limit: 24 }),
      caller.catalog.listProducts({ sort: "featured", limit: 60 }),
    ]);
  } catch {}
}
setTimeout(__prewarmCatalog, 800);
setInterval(__prewarmCatalog, 45000).unref();
