import {
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
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
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  slug: varchar("slug", { length: 180 }).notNull().unique(),
  description: text("description"),
  imageUrl: text("imageUrl"),
  color: varchar("color", { length: 24 }).default("#870210").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("categories_active_order_idx").on(table.isActive, table.sortOrder)]);

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  slug: varchar("slug", { length: 220 }).notNull().unique(),
  description: text("description"),
  imageUrl: text("imageUrl"),
  categoryId: int("categoryId").references(() => categories.id, { onDelete: "set null" }),
  price: int("price").notNull(),
  unit: varchar("unit", { length: 40 }).default("حبة").notNull(),
  stock: int("stock"),
  minQuantity: int("minQuantity").default(1).notNull(),
  quantityStep: int("quantityStep").default(1).notNull(),
  isPublished: boolean("isPublished").default(false).notNull(),
  isAvailable: boolean("isAvailable").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  index("products_category_publish_idx").on(table.categoryId, table.isPublished),
  index("products_publish_order_idx").on(table.isPublished, table.sortOrder),
]);

export const productRecommendations = mysqlTable("product_recommendations", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
  recommendedProductId: int("recommendedProductId").notNull().references(() => products.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("recommendation_pair_uq").on(table.productId, table.recommendedProductId)]);

export const banners = mysqlTable("banners", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 160 }).notNull(),
  body: text("body"),
  imageUrl: text("imageUrl"),
  actionText: varchar("actionText", { length: 60 }),
  actionUrl: varchar("actionUrl", { length: 500 }),
  isActive: boolean("isActive").default(false).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("banners_active_order_idx").on(table.isActive, table.sortOrder)]);

export const offers = mysqlTable("offers", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("offers_active_dates_idx").on(table.isActive, table.startsAt, table.endsAt)]);

export const storeSettings = mysqlTable("store_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const addresses = mysqlTable("addresses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 80 }).notNull(),
  recipientName: varchar("recipientName", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  district: varchar("district", { length: 120 }).notNull(),
  details: text("details"),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("addresses_user_idx").on(table.userId)]);

export const favorites = mysqlTable("favorites", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: int("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  uniqueIndex("favorite_user_product_uq").on(table.userId, table.productId),
  index("favorites_user_idx").on(table.userId),
]);

export const orders = mysqlTable("orders", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("orders_user_date_idx").on(table.userId, table.createdAt), index("orders_status_date_idx").on(table.status, table.createdAt)]);

export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: int("productId").references(() => products.id, { onDelete: "set null" }),
  productName: varchar("productName", { length: 180 }).notNull(),
  productImage: text("productImage"),
  unit: varchar("unit", { length: 40 }).notNull(),
  unitPrice: int("unitPrice").notNull(),
  quantity: int("quantity").notNull(),
  lineTotal: int("lineTotal").notNull(),
}, table => [index("order_items_order_idx").on(table.orderId)]);

export const orderEvents = mysqlTable("order_events", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull().references(() => orders.id, { onDelete: "cascade" }),
  status: mysqlEnum("status", ["new", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"]).notNull(),
  note: text("note"),
  changedByUserId: int("changedByUserId").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("order_events_order_idx").on(table.orderId, table.createdAt)]);

export const ownerPushSubscriptions = mysqlTable("owner_push_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  endpointHash: varchar("endpointHash", { length: 64 }).notNull(),
  encryptedPayload: text("encryptedPayload").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("owner_push_user_endpoint_uq").on(table.userId, table.endpointHash)]);

export const customerPushSubscriptions = mysqlTable("customer_push_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull().references(() => orders.id, { onDelete: "cascade" }),
  endpointHash: varchar("endpointHash", { length: 64 }).notNull(),
  encryptedPayload: text("encryptedPayload").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("customer_push_order_endpoint_uq").on(table.orderId, table.endpointHash),
  index("customer_push_order_idx").on(table.orderId),
]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Product = typeof products.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Order = typeof orders.$inferSelect;

// --- RBAC_SCHEMA_START ---
export const adminStaff = mysqlTable("admin_staff", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [
  uniqueIndex("admin_staff_username_uq").on(table.username),
  index("admin_staff_role_active_idx").on(table.roleKey, table.isActive),
]);

export const adminAuditLogs = mysqlTable("admin_audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  actorId: int("actorId"),
  actorName: varchar("actorName", { length: 160 }).notNull(),
  actorRole: varchar("actorRole", { length: 60 }).notNull(),
  action: varchar("action", { length: 80 }).notNull(),
  targetName: varchar("targetName", { length: 160 }),
  details: text("details"),
  ipAddress: varchar("ipAddress", { length: 80 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [
  index("admin_audit_created_idx").on(table.createdAt),
]);

export type AdminStaffRow = typeof adminStaff.$inferSelect;
export type InsertAdminStaffRow = typeof adminStaff.$inferInsert;
export type AdminAuditLogRow = typeof adminAuditLogs.$inferSelect;
// --- RBAC_SCHEMA_END ---
