import {
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const timestamps = {
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
};

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  ...timestamps,
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const categories = mysqlTable(
  "categories",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    description: text("description"),
    ...timestamps,
  },
  table => ({ slugIdx: uniqueIndex("categories_slug_unique").on(table.slug) })
);

export const products = mysqlTable(
  "products",
  {
    id: int("id").autoincrement().primaryKey(),
    slug: varchar("slug", { length: 180 }).notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    description: text("description").notNull(),
    shortDescription: varchar("shortDescription", { length: 500 }),
    eyebrow: varchar("eyebrow", { length: 180 }),
    longDescription: text("longDescription"),
    features: json("features").$type<string[]>().notNull(),
    tags: json("tags").$type<string[]>().notNull(),
    accent: varchar("accent", { length: 20 }),
    accentSoft: varchar("accentSoft", { length: 20 }),
    icon: varchar("icon", { length: 10 }),
    mockup: mysqlEnum("mockup", ["book", "dashboard", "browser", "phone"]).default("book").notNull(),
    checkoutUrl: varchar("checkoutUrl", { length: 500 }),
    priceNote: varchar("priceNote", { length: 120 }),
    ageRange: varchar("ageRange", { length: 80 }),
    format: mysqlEnum("format", ["standard", "story", "game"]).default("standard").notNull(),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),
    categoryId: int("categoryId")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict", onUpdate: "cascade" }),
    image: varchar("image", { length: 500 }),
    status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
    featured: int("featured").default(0).notNull(),
    downloadType: mysqlEnum("downloadType", ["file", "external"]).default("file").notNull(),
    ...timestamps,
  },
  table => ({
    slugIdx: uniqueIndex("products_slug_unique").on(table.slug),
    statusIdx: index("products_status_idx").on(table.status),
    categoryIdx: index("products_category_idx").on(table.categoryId),
  })
);

export const customers = mysqlTable(
  "customers",
  {
    id: int("id").autoincrement().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    name: varchar("name", { length: 160 }),
    userId: int("userId").references(() => users.id, { onDelete: "set null", onUpdate: "cascade" }),
    ...timestamps,
  },
  table => ({
    emailIdx: uniqueIndex("customers_email_unique").on(table.email),
    userIdx: index("customers_user_idx").on(table.userId),
  })
);

export const orders = mysqlTable(
  "orders",
  {
    id: int("id").autoincrement().primaryKey(),
    customerId: int("customerId")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict", onUpdate: "cascade" }),
    status: mysqlEnum("status", ["pending", "paid", "failed", "cancelled", "refunded"])
      .default("pending")
      .notNull(),
    subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
    discount: decimal("discount", { precision: 10, scale: 2 }).default("0.00").notNull(),
    total: decimal("total", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),
    paymentStatus: mysqlEnum("paymentStatus", ["pending", "paid", "failed", "refunded"])
      .default("pending")
      .notNull(),
    paymentProvider: varchar("paymentProvider", { length: 40 }),
    paymentReference: varchar("paymentReference", { length: 255 }),
    // Unguessable guest capability token minted at order creation. Required
    // to open a Stripe checkout session for the order (legacy rows with NULL
    // keep the previous behavior and should be treated as transitional).
    accessToken: varchar("accessToken", { length: 64 }),
    ...timestamps,
  },
  table => ({
    customerIdx: index("orders_customer_idx").on(table.customerId),
    statusIdx: index("orders_status_idx").on(table.status),
    paymentReferenceIdx: index("orders_payment_reference_idx").on(table.paymentReference),
    // Unguessable capability tokens must be unique when present. MySQL
    // permits multiple NULLs in a UNIQUE index, so legacy rows with NULL
    // stay stored but can never open a new checkout session (see
    // isOrderTokenValid): they are invalidated, not migrated with a
    // predictable value.
    accessTokenIdx: uniqueIndex("orders_access_token_unique").on(table.accessToken),
  })
);

export const orderItems = mysqlTable(
  "order_items",
  {
    id: int("id").autoincrement().primaryKey(),
    orderId: int("orderId")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade", onUpdate: "cascade" }),
    productId: int("productId")
      .notNull()
      .references(() => products.id, { onDelete: "restrict", onUpdate: "cascade" }),
    productNameSnapshot: varchar("productNameSnapshot", { length: 180 }).notNull(),
    unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
    quantity: int("quantity").notNull(),
    total: decimal("total", { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    orderIdx: index("order_items_order_idx").on(table.orderId),
    productIdx: index("order_items_product_idx").on(table.productId),
  })
);

export const digitalAssets = mysqlTable(
  "digital_assets",
  {
    id: int("id").autoincrement().primaryKey(),
    productId: int("productId")
      .notNull()
      .references(() => products.id, { onDelete: "cascade", onUpdate: "cascade" }),
    fileName: varchar("fileName", { length: 255 }).notNull(),
    storageKey: varchar("storageKey", { length: 500 }).notNull(),
    fileSize: int("fileSize"),
    mimeType: varchar("mimeType", { length: 120 }),
    version: varchar("version", { length: 40 }).default("1").notNull(),
    ...timestamps,
  },
  table => ({ productIdx: index("digital_assets_product_idx").on(table.productId) })
);

export const downloads = mysqlTable(
  "downloads",
  {
    id: int("id").autoincrement().primaryKey(),
    orderId: int("orderId")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade", onUpdate: "cascade" }),
    customerId: int("customerId")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict", onUpdate: "cascade" }),
    productId: int("productId")
      .notNull()
      .references(() => products.id, { onDelete: "restrict", onUpdate: "cascade" }),
    assetId: int("assetId")
      .notNull()
      .references(() => digitalAssets.id, { onDelete: "restrict", onUpdate: "cascade" }),
    tokenHash: varchar("tokenHash", { length: 128 }).notNull(),
    downloadCount: int("downloadCount").default(0).notNull(),
    maxDownloads: int("maxDownloads").default(10).notNull(),
    lastDownloadedAt: timestamp("lastDownloadedAt"),
    expiresAt: timestamp("expiresAt"),
    ...timestamps,
  },
  table => ({
    orderIdx: index("downloads_order_idx").on(table.orderId),
    customerIdx: index("downloads_customer_idx").on(table.customerId),
    productIdx: index("downloads_product_idx").on(table.productId),
    assetIdx: index("downloads_asset_idx").on(table.assetId),
    tokenHashIdx: uniqueIndex("downloads_token_hash_unique").on(table.tokenHash),
  })
);

export const coupons = mysqlTable(
  "coupons",
  {
    id: int("id").autoincrement().primaryKey(),
    code: varchar("code", { length: 80 }).notNull(),
    discountType: mysqlEnum("discountType", ["percentage", "fixed"]).notNull(),
    discountValue: decimal("discountValue", { precision: 10, scale: 2 }).notNull(),
    maxUses: int("maxUses"),
    usedCount: int("usedCount").default(0).notNull(),
    startsAt: timestamp("startsAt"),
    expiresAt: timestamp("expiresAt"),
    active: int("active").default(1).notNull(),
    ...timestamps,
  },
  table => ({ codeIdx: uniqueIndex("coupons_code_unique").on(table.code) })
);

export const subscribers = mysqlTable(
  "subscribers",
  {
    id: int("id").autoincrement().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    name: varchar("name", { length: 160 }),
    status: mysqlEnum("status", ["subscribed", "unsubscribed"]).default("subscribed").notNull(),
    source: varchar("source", { length: 64 }).default("website").notNull(),
    ...timestamps,
  },
  table => ({ emailIdx: uniqueIndex("subscribers_email_unique").on(table.email) })
);

export const contactMessages = mysqlTable("contactMessages", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  subject: varchar("topic", { length: 80 }).notNull(),
  message: text("message").notNull(),
  status: mysqlEnum("status", ["new", "read", "replied", "archived"]).default("new").notNull(),
  ...timestamps,
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Subscriber = typeof subscribers.$inferSelect;
export type ContactMessage = typeof contactMessages.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
