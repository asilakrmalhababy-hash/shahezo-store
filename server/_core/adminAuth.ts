import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Request } from "express";
import { getDb } from "../db";
import { adminAuditLogs } from "../../drizzle/schema";

const FORBIDDEN_WEAK_PASSWORDS = new Set([
  "123456", "12345678", "123456789", "password", "admin", "admin123", "000000", "111111", "qwerty"
]);

let __rbacTablesEnsured = false;
export async function ensureRbacTables(dbInstance?: any): Promise<void> {
  if (__rbacTablesEnsured) return;
  try {
    const db = dbInstance || (await getDb());
    if (!db) return;
    await db.execute(sql.raw("CREATE TABLE IF NOT EXISTS admin_staff (id int AUTO_INCREMENT NOT NULL, userId int NULL, username varchar(120) NOT NULL, displayName varchar(160) NOT NULL, passwordHash varchar(255) NOT NULL, roleKey varchar(40) NOT NULL DEFAULT 'staff', permissionsJson text NOT NULL, isActive boolean NOT NULL DEFAULT true, mustChangePassword boolean NOT NULL DEFAULT true, sessionVersion int NOT NULL DEFAULT 1, createdBy varchar(160) NULL, lastLoginAt timestamp NULL, createdAt timestamp NOT NULL DEFAULT (now()), updatedAt timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP, CONSTRAINT admin_staff_id PRIMARY KEY(id), CONSTRAINT admin_staff_username_uq UNIQUE(username))"));
    await db.execute(sql.raw("CREATE TABLE IF NOT EXISTS admin_audit_logs (id int AUTO_INCREMENT NOT NULL, actorId int NULL, actorName varchar(160) NOT NULL, actorRole varchar(60) NOT NULL, action varchar(80) NOT NULL, targetName varchar(160) NULL, details text NULL, ipAddress varchar(80) NULL, createdAt timestamp NOT NULL DEFAULT (now()), CONSTRAINT admin_audit_logs_id PRIMARY KEY(id))"));
    try { await db.execute(sql.raw("ALTER TABLE products MODIFY COLUMN imageUrl LONGTEXT NULL")); } catch {}
    try { await db.execute(sql.raw("ALTER TABLE categories MODIFY COLUMN imageUrl LONGTEXT NULL")); } catch {}
    try { await db.execute(sql.raw("ALTER TABLE banners MODIFY COLUMN imageUrl LONGTEXT NULL")); } catch {}
    try { await db.execute(sql.raw("ALTER TABLE store_settings MODIFY COLUMN value LONGTEXT NOT NULL")); } catch {}
    try { await db.execute(sql.raw("ALTER TABLE order_items MODIFY COLUMN productImage LONGTEXT NULL")); } catch {}
    try { await db.execute(sql.raw("UPDATE order_items SET productImage = CONCAT('/api/fast-img/product/', productId) WHERE productId IS NOT NULL AND productImage LIKE 'data:image/%'")); } catch {}
    __rbacTablesEnsured = true;
  } catch (err) {
    console.warn("[RBAC] Table init notice:", err instanceof Error ? err.message : "unknown");
  }
}

export function hashAdminPassword(plainPassword: string): string {
  const normalized = plainPassword.normalize("NFKC");
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(normalized, salt, 64).toString("hex");
  return "scrypt$" + salt + "$" + derived;
}

export function verifyAdminPassword(plainPassword: string, storedHash: string): boolean {
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

export function getConfiguredOwnerPassword(): { configured: string; valid: boolean; reason?: string } {
  const raw = (process.env.ADMIN_PASSWORD ?? "").trim();
  if (!raw) {
    return { configured: "", valid: false, reason: "لم يتم ضبط متغير البيئة ADMIN_PASSWORD في الخادم." };
  }
  if (FORBIDDEN_WEAK_PASSWORDS.has(raw.toLowerCase()) || raw.length < 6) {
    return { configured: "", valid: false, reason: "كلمة المرور المضبوطة في ADMIN_PASSWORD ضعيفة أو افتراضية (مثل 123456)؛ يرفض النظام العمل بها." };
  }
  return { configured: raw, valid: true };
}

export function verifyOwnerMasterPassword(candidate: string): { ok: boolean; error?: string } {
  if (!candidate || FORBIDDEN_WEAK_PASSWORDS.has(candidate.trim().toLowerCase())) {
    return { ok: false, error: "كلمة المرور غير صحيحة." };
  }
  const check = getConfiguredOwnerPassword();
  if (!check.valid) {
    return { ok: false, error: check.reason || "إعدادات مصادقة المالك غير مكتملة." };
  }
  const a = createHash("sha256").update(candidate, "utf8").digest();
  const b = createHash("sha256").update(check.configured, "utf8").digest();
  const matched = timingSafeEqual(a, b);
  return matched ? { ok: true } : { ok: false, error: "كلمة المرور غير صحيحة." };
}

export function getOwnerSessionOpenId(): string {
  const check = getConfiguredOwnerPassword();
  if (!check.valid) return "owner_disabled_unconfigured";
  const digest = createHash("sha256").update("original-owner-v2::" + check.configured, "utf8").digest("hex").slice(0, 16);
  return "owner_root_" + digest;
}

type RateBucket = { count: number; firstFailedAt: number; lockedUntil: number };
const loginRateMap = new Map<string, RateBucket>();
const MAX_LOGIN_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

export function getClientIp(req: Request): string {
  const xff = req.headers["x-forwarded-for"];
  const first = Array.isArray(xff) ? xff[0] : typeof xff === "string" ? xff.split(",")[0] : "";
  return (first?.trim() || req.ip || "unknown-ip").slice(0, 80);
}

export function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = loginRateMap.get(ip);
  if (!bucket) return { allowed: true, retryAfterSeconds: 0 };
  if (bucket.lockedUntil > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.lockedUntil - now) / 1000) };
  }
  if (now - bucket.firstFailedAt > WINDOW_MS) {
    loginRateMap.delete(ip);
    return { allowed: true, retryAfterSeconds: 0 };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordLoginFailure(ip: string): { locked: boolean; remainingAttempts: number } {
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

export function clearLoginFailures(ip: string): void {
  loginRateMap.delete(ip);
}

export function resetAllLoginRateLimitsForTests(): void {
  loginRateMap.clear();
}

export async function writeAdminAuditLog(entry: {
  actorId?: number | null;
  actorName: string;
  actorRole: string;
  action: string;
  targetName?: string | null;
  details?: string | null;
  ipAddress?: string | null;
}): Promise<void> {
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
      details: entry.details ? entry.details.slice(0, 2000) : null,
      ipAddress: entry.ipAddress ? entry.ipAddress.slice(0, 80) : null,
    });
  } catch (err) {
    console.warn("[AuditLog] Failed to record entry:", err instanceof Error ? err.message : "unknown");
  }
}
