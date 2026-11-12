import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import { PERMISSION_LABELS, ROLE_DEFINITIONS, hasPermission, type AdminRoleKey, type PermissionKey } from "@shared/rbac";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { getClientIp, writeAdminAuditLog } from "./adminAuth";

const t = initTRPC.context<TrpcContext>().create({ transformer: superjson });
export const router = t.router;
export const publicProcedure = t.procedure;

const lastSectionViewMap = new Map<string, { section: string; time: number }>();

const ORDER_STATUS_AR: Record<string, string> = {
  new: "جديد",
  preparing: "قيد التجهيز",
  ready: "جاهز للتوصيل",
  out_for_delivery: "خرج للتوصيل",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

function getArabicRoleName(role?: string | null, isOwner?: boolean): string {
  if (isOwner || role === "owner") return "مالك المتجر";
  if (role && ROLE_DEFINITIONS[role as AdminRoleKey]) return ROLE_DEFINITIONS[role as AdminRoleKey].label;
  return "مشرف إداري";
}

function recordArabicAdminActivity(ctx: TrpcContext, path: string, type: string, rawInput: unknown) {
  try {
    const user = ctx.user;
    if (!user || user.role !== "admin") return;
    const isOwner = Boolean(user.isOwner ?? (!user.adminRole && user.role === "admin"));
    const actorId = user.staffId ?? user.id ?? null;
    const actorName = user.name || (isOwner ? "مالك المتجر" : "مشرف");
    const actorRole = getArabicRoleName(user.adminRole, isOwner);
    const ip = getClientIp(ctx.req);
    const inp = (rawInput && typeof rawInput === "object") ? (rawInput as Record<string, any>) : {};

    if (type === "query") {
      const viewMap: Record<string, { section: string; target: string; details: string }> = {
        "commerce.admin.overview": { section: "overview", target: "قسم نظرة عامة", details: "دخل قسم «نظرة عامة» وشاهد إحصائيات المتجر والطلبات الحديثة" },
        "commerce.admin.orders.list": { section: "orders", target: "قسم الطلبات", details: "دخل قسم «إدارة الطلبات» وشاهد قائمة طلبات الزبائن" },
        "commerce.admin.products.list": { section: "products", target: "قسم المنتجات", details: "دخل قسم «إدارة المنتجات» وشاهد قائمة المنتجات والأسعار" },
        "commerce.admin.categories.list": { section: "categories", target: "قسم الأقسام", details: "دخل قسم «إدارة الأقسام» وشاهد أقسام المتجر" },
        "commerce.admin.chats.list": { section: "chats", target: "قسم المحادثات", details: "دخل قسم «محادثات الزبائن» وشاهد رسائل الزبائن مع المساعد الذكي" },
        "commerce.admin.banners.list": { section: "banners", target: "قسم البنرات", details: "دخل قسم «البنرات الإعلانية» وشاهد البنرات المعروضة" },
        "commerce.admin.offers.list": { section: "offers", target: "قسم العروض", details: "دخل قسم «العروض والخصومات» وشاهد الكوبونات والعروض" },
        "commerce.admin.users.list": { section: "users", target: "قسم العملاء", details: "دخل قسم «سجل العملاء» وشاهد بيانات وعناوين الزبائن" },
        "commerce.admin.settings.get": { section: "settings", target: "قسم الإعدادات", details: "دخل قسم «إعدادات المتجر» وشاهد إعدادات التوصيل والمكافآت" },
      };
      const v = viewMap[path];
      if (v) {
        const actorKey = String(actorId || actorName);
        const prev = lastSectionViewMap.get(actorKey);
        const now = Date.now();
        if (!prev || prev.section !== v.section || (now - prev.time > 5 * 60 * 1000)) {
          lastSectionViewMap.set(actorKey, { section: v.section, time: now });
          void writeAdminAuditLog({
            actorId,
            actorName,
            actorRole,
            action: "👁️ تصفح ومشاهدة قسم",
            targetName: v.target,
            details: v.details,
            ipAddress: ip,
          });
        }
      }
      return;
    }

    if (type === "mutation") {
      if (path.startsWith("commerce.admin.staff.") || path.startsWith("commerce.admin.notifications.")) return;
      let actionAr = "⚡ تنفيذ إجراء إداري";
      let targetAr = "";
      let detailsAr = "";

      if (path === "commerce.admin.products.bulkCreate") {
        const items = Array.isArray(inp.items) ? inp.items : [];
        actionAr = "🚀 إضافة جماعية للمنتجات";
        targetAr = "دفعة من " + items.length + " منتج";
        detailsAr = "أضاف " + items.length + " منتجاً دفعة واحدة (" + items.slice(0, 6).map((x: any) => x.name).join("، ") + (items.length > 6 ? "..." : "") + ")";
      } else if (path === "commerce.admin.products.create") {
        actionAr = "➕ إضافة منتج جديد";
        targetAr = "المنتج: " + (inp.name || "");
        detailsAr = "أضاف منتج جديد «" + (inp.name || "") + "» بسعر " + (inp.price ?? 0) + " ر.ي (" + (inp.unit || "") + ")";
      } else if (path === "commerce.admin.products.update") {
        actionAr = "✏️ تعديل منتج";
        const vals = inp.values || {};
        targetAr = vals.name ? ("المنتج: " + vals.name) : ("منتج رقم #" + inp.id);
        detailsAr = vals.name
          ? ("عدّل بيانات المنتج «" + vals.name + "» — السعر: " + (vals.price ?? "") + " ر.ي")
          : ("عدّل حالة/توفر المنتج رقم #" + inp.id);
      } else if (path === "commerce.admin.products.delete" || path === "commerce.admin.products.archive") {
        actionAr = "🗑️ حذف منتج";
        targetAr = "منتج رقم #" + inp.id;
        detailsAr = "قام بحذف أو إخفاء المنتج رقم #" + inp.id;
      } else if (path === "commerce.admin.products.setRecommendations") {
        actionAr = "🔗 ربط منتجات مقترحة";
        targetAr = "منتج رقم #" + inp.productId;
        detailsAr = "حدّث قائمة المنتجات المقترحة المرتبطة بالمنتج رقم #" + inp.productId;
      } else if (path === "commerce.admin.categories.create") {
        actionAr = "📁 إضافة قسم جديد";
        targetAr = "قسم: " + (inp.name || "");
        detailsAr = "أنشأ قسماً جديداً باسم «" + (inp.name || "") + "»";
      } else if (path === "commerce.admin.categories.update") {
        actionAr = "✏️ تعديل قسم";
        const vals = inp.values || {};
        targetAr = vals.name ? ("قسم: " + vals.name) : ("قسم رقم #" + inp.id);
        detailsAr = vals.name ? ("عدّل بيانات القسم «" + vals.name + "»") : ("غيّر حالة تفعيل القسم رقم #" + inp.id);
      } else if (path === "commerce.admin.categories.delete" || path === "commerce.admin.categories.archive") {
        actionAr = "🗑️ حذف قسم";
        targetAr = "قسم رقم #" + inp.id;
        detailsAr = "قام بحذف القسم رقم #" + inp.id;
      } else if (path === "commerce.admin.products.bulkAdjustPrices") {
        actionAr = "💰 تعديل جماعي لأسعار المنتجات";
        targetAr = inp.categoryId ? ("قسم رقم #" + inp.categoryId) : "كل المنتجات";
        detailsAr = "عدّل الأسعار جماعياً (" + (inp.mode === "percent" ? (inp.amount + "%") : (inp.amount + " ر.ي")) + ")";
      } else if (path === "commerce.admin.orders.removeItem") {
        actionAr = "❌ إلغاء صنف من فاتورة طلب";
        targetAr = "طلب رقم #" + inp.orderId;
        detailsAr = "ألغى صنفاً غير متوفر من الطلب رقم #" + inp.orderId + " — السبب: " + (inp.reason || "");
      } else if (path === "commerce.admin.orders.updateStatus" || path === "commerce.admin.orders.setStatus") {
        actionAr = "📦 تحديث حالة طلب";
        const stAr = ORDER_STATUS_AR[inp.status] || inp.status || "";
        targetAr = "طلب رقم #" + inp.id;
        detailsAr = "غيّر حالة الطلب رقم #" + inp.id + " إلى «" + stAr + "»" + (inp.note ? (" — ملاحظة: " + inp.note) : "");
      } else if (path === "commerce.admin.chats.reply") {
        actionAr = "💬 رد مباشر في المحادثة";
        targetAr = "محادثة زبون";
        detailsAr = "أرسل رداً مباشراً للزبون: «" + String(inp.text || "").slice(0, 120) + "»";
      } else if (path === "commerce.admin.chats.toggleAi") {
        actionAr = "🤖 تحكم بالمساعد في محادثة";
        targetAr = "محادثة زبون";
        detailsAr = inp.aiPaused ? "أوقف الرد التلقائي للذكاء الاصطناعي في المحادثة للرد بنفسه" : "أعاد تفعيل الرد التلقائي للذكاء الاصطناعي في المحادثة";
      } else if (path === "commerce.admin.chats.delete") {
        actionAr = "🗑️ حذف محادثة";
        targetAr = "محادثة زبون";
        detailsAr = "قام بحذف سجل المحادثة";
      } else if (path.startsWith("commerce.admin.banners.")) {
        const sub = path.split(".").pop();
        const vals = inp.values || inp;
        actionAr = sub === "create" ? "🖼️ إضافة بنر إعلاني" : sub === "delete" ? "🗑️ حذف بنر إعلاني" : "✏️ تعديل بنر إعلاني";
        targetAr = vals.title ? ("بنر: " + vals.title) : ("بنر رقم #" + (inp.id || ""));
        detailsAr = actionAr + (vals.title ? (" «" + vals.title + "»") : "");
      } else if (path.startsWith("commerce.admin.offers.")) {
        const sub = path.split(".").pop();
        const vals = inp.values || inp;
        actionAr = sub === "create" ? "🏷️ إضافة عرض خصم" : sub === "delete" ? "🗑️ حذف عرض خصم" : "✏️ تعديل عرض خصم";
        targetAr = vals.title ? ("عرض: " + vals.title) : ("عرض رقم #" + (inp.id || ""));
        detailsAr = actionAr + (vals.title ? (" «" + vals.title + "»") : "") + (vals.code ? (" (كود: " + vals.code + ")") : "");
      } else if (path === "commerce.admin.settings.update") {
        actionAr = "⚙️ تعديل إعدادات المتجر";
        targetAr = "الإعدادات العامة";
        detailsAr = "قام بتعديل وحفظ إعدادات المتجر والتوصيل والمكافآت";
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
        ipAddress: ip,
      });
    }
  } catch {}
}

const requireUser = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  if (ctx.user.suspended) throw new TRPCError({ code: "FORBIDDEN", message: "تم إيقاف هذا الحساب. تواصل مع إدارة المتجر." });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, path, type, next } = opts;
    let rawInput: any = (opts as any).input;
    if (!rawInput && typeof (opts as any).getRawInput === "function") {
      try { rawInput = await (opts as any).getRawInput(); } catch {}
    }
    if (rawInput && typeof rawInput === "object" && "json" in rawInput) rawInput = rawInput.json;
    if (!ctx.user || ctx.user.role !== "admin" || ctx.user.suspended) {
      throw new TRPCError({ code: ctx.user ? "FORBIDDEN" : "UNAUTHORIZED", message: NOT_ADMIN_ERR_MSG });
    }
    if (ctx.user.mustChangePassword) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "يجب تغيير كلمة المرور المؤقتة أولاً قبل تنفيذ أي عملية إدارية." });
    }
    const res = await next({ ctx: { ...ctx, user: ctx.user } });
    recordArabicAdminActivity(ctx, path, type, rawInput);
    return res;
  }),
);

export function requirePermission(permission: PermissionKey) {
  return adminProcedure.use(
    t.middleware(async ({ ctx, next }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: NOT_ADMIN_ERR_MSG });
      const user = ctx.user;
      const isOwner = user.isOwner ?? (user.adminRole === undefined && user.role === "admin");
      const allowed = hasPermission(user.permissions, isOwner, permission);
      if (!allowed) {
        const label = PERMISSION_LABELS[permission]?.label || permission;
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "ليس لديك صلاحية («" + label + "») لتنفيذ هذا الإجراء.",
        });
      }
      return next({ ctx: { ...ctx, user } });
    }),
  );
}

export function requireAnyPermission(permissions: PermissionKey[]) {
  return adminProcedure.use(
    t.middleware(async ({ ctx, next }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: NOT_ADMIN_ERR_MSG });
      const user = ctx.user;
      const isOwner = user.isOwner ?? (user.adminRole === undefined && user.role === "admin");
      const allowed = permissions.some(p => hasPermission(user.permissions, isOwner, p));
      if (!allowed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "ليس لديك الصلاحية الكافية لتنفيذ هذا الإجراء.",
        });
      }
      return next({ ctx: { ...ctx, user } });
    }),
  );
}
