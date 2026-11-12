import { COOKIE_NAME, ONE_YEAR_MS, OAUTH_STATE_COOKIE, decodeOAuthState } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import { eq } from "drizzle-orm";
import type { Express, Request, Response } from "express";
import { adminStaff, users } from "../../drizzle/schema";
import * as db from "../db";
import {
  checkLoginRateLimit,
  clearLoginFailures,
  ensureRbacTables,
  getClientIp,
  getOwnerSessionOpenId,
  recordLoginFailure,
  verifyAdminPassword,
  verifyOwnerMasterPassword,
  writeAdminAuditLog,
} from "./adminAuth";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { isConfiguredOwnerIdentity } from "./owner";
import { sdk } from "./sdk";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export async function handleAdminPasswordLogin(req: Request, res: Response) {
  const cookieOptions = getSessionCookieOptions(req);
  if (req.method !== "POST") {
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.status(405).json({ error: "طريقة الطلب غير مسموحة. استخدم POST فقط." });
    return;
  }

  const ip = getClientIp(req);
  const rate = checkLoginRateLimit(ip);
  if (!rate.allowed) {
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.status(429).json({
      error: "تم حظر محاولات الدخول مؤقتاً بسبب تكرار المحاولات الخاطئة. يرجى الانتظار " + Math.ceil(rate.retryAfterSeconds / 60) + " دقيقة.",
    });
    return;
  }

  const rawUsername = typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : "";
  const rawPassword = typeof req.body?.password === "string" ? req.body.password : "";

  if (!rawPassword) {
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.status(400).json({ error: "يرجى إدخال كلمة المرور." });
    return;
  }

  const isOwnerAttempt = !rawUsername || rawUsername === "owner" || rawUsername === "admin" || (Boolean(ENV.ownerEmail) && rawUsername === ENV.ownerEmail.toLowerCase());

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
          targetName: "مالك المتجر",
          details: check.error || "محاولة دخول فاشلة لحساب المالك",
          ipAddress: ip,
        });
        res.status(401).json({
          error: fail.locked
            ? "تم قفل الدخول لمدة 15 دقيقة لتجاوز عدد المحاولات المسموحة."
            : (check.error || "كلمة المرور غير صحيحة."),
        });
        return;
      }

      clearLoginFailures(ip);
      const ownerOpenId = getOwnerSessionOpenId();
      const database = await db.getDb();
      if (database) {
        await ensureRbacTables(database);
        await database.insert(users).values({
          openId: ownerOpenId,
          name: "مالك المتجر",
          email: ENV.ownerEmail || "owner@shahezo-store.local",
          loginMethod: "admin_password",
          role: "admin",
          suspended: false,
          lastSignedIn: new Date(),
        }).onDuplicateKeyUpdate({
          set: { role: "admin", suspended: false, lastSignedIn: new Date() },
        });
      }

      const sessionToken = await sdk.createSessionToken(ownerOpenId, {
        name: "مالك المتجر",
        expiresInMs: SEVEN_DAYS_MS,
      });

      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SEVEN_DAYS_MS });
      await writeAdminAuditLog({
        actorName: "مالك المتجر",
        actorRole: "owner",
        action: "LOGIN_SUCCESS",
        targetName: "لوحة المالك",
        details: "تسجيل دخول ناجح لمالك المتجر",
        ipAddress: ip,
      });

      res.status(200).json({
        success: true,
        role: "owner",
        isOwner: true,
        mustChangePassword: false,
      });
      return;
    }

    const database = await db.getDb();
    if (!database) {
      res.status(503).json({ error: "قاعدة البيانات غير متاحة مؤقتاً." });
      return;
    }
    await ensureRbacTables(database);

    const staffRows = await database.select().from(adminStaff).where(eq(adminStaff.username, rawUsername)).limit(1);
    const staff = staffRows[0];

    if (!staff || !verifyAdminPassword(rawPassword, staff.passwordHash)) {
      const fail = recordLoginFailure(ip);
      res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      await writeAdminAuditLog({
        actorName: rawUsername,
        actorRole: "unauthenticated",
        action: "LOGIN_FAILED_STAFF",
        targetName: rawUsername,
        details: "محاولة دخول فاشلة لحساب إداري",
        ipAddress: ip,
      });
      res.status(401).json({
        error: fail.locked
          ? "تم قفل الدخول لمدة 15 دقيقة لتجاوز عدد المحاولات المسموحة."
          : "اسم المستخدم أو كلمة المرور غير صحيحة.",
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
        details: "محاولة دخول لحساب إداري معطل",
        ipAddress: ip,
      });
      res.status(403).json({ error: "تم تعطيل هذا الحساب الإداري. يرجى التواصل مع مالك المتجر." });
      return;
    }

    clearLoginFailures(ip);
    const staffOpenId = "staff_" + staff.id + "_v" + staff.sessionVersion;
    const now = new Date();

    await database.insert(users).values({
      openId: "staff_user_" + staff.id,
      name: staff.displayName,
      email: staff.username.includes("@") ? staff.username : null,
      loginMethod: "staff_password",
      role: "admin",
      suspended: false,
      lastSignedIn: now,
    }).onDuplicateKeyUpdate({
      set: { name: staff.displayName, role: "admin", suspended: false, lastSignedIn: now },
    });
    const linkedUser = await db.getUserByOpenId("staff_user_" + staff.id);
    await database.update(adminStaff).set({
      lastLoginAt: now,
      ...(linkedUser ? { userId: linkedUser.id } : {}),
    }).where(eq(adminStaff.id, staff.id));

    const sessionToken = await sdk.createSessionToken(staffOpenId, {
      name: staff.displayName,
      expiresInMs: SEVEN_DAYS_MS,
    });

    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SEVEN_DAYS_MS });
    await writeAdminAuditLog({
      actorId: staff.id,
      actorName: staff.displayName,
      actorRole: staff.roleKey,
      action: "LOGIN_SUCCESS",
      targetName: staff.username,
      details: "تسجيل دخول إداري ناجح",
      ipAddress: ip,
    });

    res.status(200).json({
      success: true,
      role: staff.roleKey,
      isOwner: false,
      mustChangePassword: Boolean(staff.mustChangePassword),
    });
  } catch (err) {
    console.error("[AdminAuth] Login error:", err instanceof Error ? err.message : "unknown");
    res.status(500).json({ error: "حدث خطأ أثناء التحقق من بيانات الدخول." });
  }
}

export function registerOAuthRoutes(app: Express) {
  app.post("/api/admin-login", handleAdminPasswordLogin);
  app.all("/api/admin-login", (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.status(405).json({ error: "استخدم طلب POST فقط لتسجيل الدخول." });
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
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
      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
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
