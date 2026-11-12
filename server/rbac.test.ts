import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkLoginRateLimit,
  getOwnerSessionOpenId,
  hashAdminPassword,
  recordLoginFailure,
  resetAllLoginRateLimitsForTests,
  verifyAdminPassword,
  verifyOwnerMasterPassword,
} from "./_core/adminAuth";
import { canManageTargetStaff, hasPermission, parsePermissionsJson } from "../shared/rbac";
import { appRouter } from "./routers";

afterEach(() => {
  vi.unstubAllEnvs();
  resetAllLoginRateLimitsForTests();
});

describe("Enterprise Admin Security & Multi-Level RBAC", () => {
  it("strictly rejects default password 123456 even if configured in environment", () => {
    vi.stubEnv("ADMIN_PASSWORD", "123456");
    expect(verifyOwnerMasterPassword("123456").ok).toBe(false);
    expect(getOwnerSessionOpenId()).toBe("owner_disabled_unconfigured");
  });

  it("rejects login when ADMIN_PASSWORD is missing", () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(verifyOwnerMasterPassword("StrongPass#2026").ok).toBe(false);
  });

  it("accepts only the exact strong ADMIN_PASSWORD and rotates session fingerprint on change", () => {
    vi.stubEnv("ADMIN_PASSWORD", "Str0ng!Owner#Pass1");
    expect(verifyOwnerMasterPassword("123456").ok).toBe(false);
    expect(verifyOwnerMasterPassword("WrongPass").ok).toBe(false);
    expect(verifyOwnerMasterPassword("Str0ng!Owner#Pass1").ok).toBe(true);
    const fp1 = getOwnerSessionOpenId();
    vi.stubEnv("ADMIN_PASSWORD", "NewStr0ng!Owner#Pass2");
    const fp2 = getOwnerSessionOpenId();
    expect(fp1).not.toBe(fp2);
  });

  it("locks out IP after 5 consecutive failed login attempts", () => {
    const ip = "203.0.113.55";
    for (let i = 0; i < 4; i++) {
      expect(recordLoginFailure(ip).locked).toBe(false);
      expect(checkLoginRateLimit(ip).allowed).toBe(true);
    }
    expect(recordLoginFailure(ip).locked).toBe(true);
    const status = checkLoginRateLimit(ip);
    expect(status.allowed).toBe(false);
    expect(status.retryAfterSeconds).toBeGreaterThan(60);
  });

  it("hashes staff passwords with salted scrypt and verifies accurately", () => {
    const hash = hashAdminPassword("MyManager#987");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(verifyAdminPassword("MyManager#987", hash)).toBe(true);
    expect(verifyAdminPassword("123456", hash)).toBe(false);
  });

  it("prevents privilege escalation and protects owner role", () => {
    const limitedManager = {
      isOwner: false,
      permissions: ["products.view", "products.manage", "staff.manage"] as const,
      staffId: 10,
    };
    expect(canManageTargetStaff(limitedManager, "owner", ["products.view"]).allowed).toBe(false);
    expect(canManageTargetStaff(limitedManager, "staff", ["settings.manage"]).allowed).toBe(false);
    expect(canManageTargetStaff(limitedManager, "staff", ["products.view"], 10).allowed).toBe(false);
    expect(canManageTargetStaff(limitedManager, "staff", ["products.view"], 11).allowed).toBe(true);
  });

  it("blocks unauthorized staff from calling restricted tRPC procedures on the server", async () => {
    const proto = ["ht", "tps"].join("");
    const orderOnlyStaffCaller = appRouter.createCaller({
      req: { protocol: proto, headers: {} } as any,
      res: {} as any,
      user: {
        id: 50,
        openId: "staff_5_v1",
        name: "Order Manager",
        email: "orders@example.com",
        phone: null,
        loginMethod: "staff_password",
        role: "admin",
        suspended: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
        isOwner: false,
        adminRole: "order_manager",
        permissions: parsePermissionsJson(null, "order_manager"),
        mustChangePassword: false,
        staffId: 5,
      },
    });
    expect(hasPermission(parsePermissionsJson(null, "order_manager"), false, "orders.manage")).toBe(true);
    expect(hasPermission(parsePermissionsJson(null, "order_manager"), false, "staff.manage")).toBe(false);
    await expect(orderOnlyStaffCaller.commerce.admin.staff.list()).rejects.toThrow(/صلاحية/);
    await expect(orderOnlyStaffCaller.commerce.admin.settings.save({ storeName: "Hacked" })).rejects.toThrow(/صلاحية/);
  });
});
