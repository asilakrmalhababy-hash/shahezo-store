export const PERMISSION_KEYS = [
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
  "staff.manage",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_LABELS: Record<PermissionKey, { label: string; group: string; sensitive?: boolean }> = {
  "overview.view": { label: "عرض التقارير والإحصائيات", group: "التقارير" },
  "products.view": { label: "عرض المنتجات فقط", group: "المنتجات والمخزون" },
  "products.add": { label: "إضافة منتجات جديدة فقط (بدون حذف)", group: "المنتجات والمخزون" },
  "products.edit": { label: "تعديل المنتجات والأسعار (بدون حذف)", group: "المنتجات والمخزون" },
  "products.delete": { label: "حذف المنتجات نهائياً", group: "المنتجات والمخزون", sensitive: true },
  "products.manage": { label: "إدارة كاملة للمنتجات (إضافة وتعديل وحذف)", group: "المنتجات والمخزون" },
  "inventory.manage": { label: "تحديث السعر والمخزون والتوفر فقط", group: "المنتجات والمخزون" },
  "categories.manage": { label: "إدارة الأقسام والتصنيفات", group: "المنتجات والمخزون" },
  "orders.view": { label: "عرض الطلبات وتصديرها", group: "الطلبات والعملاء" },
  "orders.manage": { label: "تحديث حالات الطلبات وإلغاء الأصناف والتوصيل", group: "الطلبات والعملاء" },
  "customers.view": { label: "عرض سجل العملاء", group: "الطلبات والعملاء" },
  "chats.manage": { label: "إدارة محادثات الزبائن والرد المباشر", group: "الطلبات والعملاء" },
  "banners.manage": { label: "إدارة الإعلانات والبنرات", group: "المحتوى والعروض" },
  "offers.manage": { label: "إدارة العروض والخصومات", group: "المحتوى والعروض" },
  "settings.manage": { label: "إدارة إعدادات المتجر والتوصيل", group: "الإدارة العليا", sensitive: true },
  "staff.manage": { label: "إدارة الموظفين والصلاحيات (مفوض)", group: "الإدارة العليا", sensitive: true },
};

export const ROLE_KEYS = [
  "owner",
  "general_manager",
  "product_manager",
  "order_manager",
  "content_manager",
  "staff",
] as const;

export type AdminRoleKey = (typeof ROLE_KEYS)[number];

export const ROLE_DEFINITIONS: Record<AdminRoleKey, { label: string; description: string; defaultPermissions: PermissionKey[] }> = {
  owner: {
    label: "مالك المتجر",
    description: "تحكم كامل في النظام وإدارة المديرين والصلاحيات والإعدادات الحساسة",
    defaultPermissions: [...PERMISSION_KEYS],
  },
  general_manager: {
    label: "مدير عام",
    description: "إدارة العمليات اليومية للمتجر والمنتجات والطلبات والعروض",
    defaultPermissions: [
      "overview.view", "products.view", "products.add", "products.edit", "products.delete", "products.manage", "inventory.manage",
      "categories.manage", "orders.view", "orders.manage", "banners.manage",
      "offers.manage", "customers.view", "chats.manage",
    ],
  },
  product_manager: {
    label: "مدير منتجات",
    description: "إضافة المنتجات وتعديلها وإدارة المخزون والأسعار (بدون حذف إلا بتفويض)",
    defaultPermissions: [
      "overview.view", "products.view", "products.add", "products.edit", "inventory.manage",
    ],
  },
  order_manager: {
    label: "مدير طلبات",
    description: "عرض الطلبات وتحديث حالاتها وإلغاء النواقص وإدارة التوصيل والرد على الزبائن",
    defaultPermissions: [
      "overview.view", "orders.view", "orders.manage", "customers.view", "chats.manage",
    ],
  },
  content_manager: {
    label: "مدير محتوى وعروض",
    description: "إدارة الإعلانات والعروض الترويجية وعرض المنتجات",
    defaultPermissions: [
      "overview.view", "products.view", "banners.manage", "offers.manage",
    ],
  },
  staff: {
    label: "موظف / مشرف مخصص",
    description: "صلاحيات وأقسام محددة يختارها مالك المتجر بدقة",
    defaultPermissions: [
      "products.view", "products.add",
    ],
  },
};

export function parsePermissionsJson(raw: string | null | undefined, roleKey: AdminRoleKey): PermissionKey[] {
  if (roleKey === "owner") return [...PERMISSION_KEYS];
  if (!raw) return [...(ROLE_DEFINITIONS[roleKey]?.defaultPermissions ?? [])];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...(ROLE_DEFINITIONS[roleKey]?.defaultPermissions ?? [])];
    const valid = new Set<string>(PERMISSION_KEYS);
    return [...new Set(parsed.filter((p): p is PermissionKey => typeof p === "string" && valid.has(p)))];
  } catch {
    return [...(ROLE_DEFINITIONS[roleKey]?.defaultPermissions ?? [])];
  }
}

export function parseAllowedCategoriesJson(raw: string | null | undefined, roleKey?: AdminRoleKey | null): number[] {
  if (roleKey === "owner" || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const ids: number[] = [];
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

export function serializePermissionsAndCategories(
  permissions: readonly PermissionKey[],
  allowedCategoryIds?: readonly number[] | null,
): string {
  const uniquePerms = [...new Set(permissions)];
  const catTags = Array.isArray(allowedCategoryIds)
    ? [...new Set(allowedCategoryIds.filter(id => Number.isInteger(id) && id > 0))].map(id => "cat:" + id)
    : [];
  return JSON.stringify([...uniquePerms, ...catTags]);
}

export function hasPermission(userPermissions: readonly string[] | undefined, isOwner: boolean | undefined, required: PermissionKey): boolean {
  if (isOwner) return true;
  if (!userPermissions) return false;
  if (userPermissions.includes(required)) return true;
  if (
    (required === "products.view" || required === "products.add" || required === "products.edit" || required === "products.delete" || required === "inventory.manage") &&
    userPermissions.includes("products.manage")
  ) {
    return true;
  }
  if (
    required === "products.view" &&
    (userPermissions.includes("products.add") || userPermissions.includes("products.edit") || userPermissions.includes("inventory.manage"))
  ) {
    return true;
  }
  if (required === "inventory.manage" && userPermissions.includes("products.edit")) {
    return true;
  }
  return false;
}

export function canManageTargetStaff(
  actor: { isOwner?: boolean; permissions?: readonly string[]; staffId?: number | null },
  targetRole: AdminRoleKey,
  requestedPermissions: readonly PermissionKey[],
  targetStaffId?: number | null,
): { allowed: boolean; reason?: string } {
  if (targetRole === "owner") {
    return { allowed: false, reason: "لا يمكن إنشاء حساب مالك آخر أو تعديل رتبة المالك." };
  }
  if (actor.isOwner) return { allowed: true };
  if (!actor.permissions?.includes("staff.manage")) {
    return { allowed: false, reason: "ليس لديك صلاحية إدارة المديرين والموظفين." };
  }
  if (targetStaffId && actor.staffId && targetStaffId === actor.staffId) {
    return { allowed: false, reason: "لا يمكنك تعديل صلاحيات حسابك الشخصي." };
  }
  const actorPerms = new Set(actor.permissions);
  for (const perm of requestedPermissions) {
    if (!actorPerms.has(perm) && !hasPermission(actor.permissions, false, perm)) {
      return { allowed: false, reason: "لا يمكنك منح صلاحية لا تملكها في حسابك." };
    }
  }
  return { allowed: true };
}
