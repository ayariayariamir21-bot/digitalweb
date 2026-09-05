import { and, asc, count, desc, eq, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  categories,
  customers,
  digitalAssets,
  downloads,
  orderItems,
  orders,
  products,
} from "../drizzle/schema";
import { getDb, getInsertId } from "./db";
import { storage } from "./storage";

/**
 * Business error whose message is safe to return to an admin client.
 * Anything else (driver errors, connection failures) must be replaced by a
 * generic fallback in the router so DB internals never leak to the frontend.
 */
export class PublicSafeError extends Error {}

export function safeAdminMessage(error: unknown, fallback: string): string {
  if (error instanceof PublicSafeError) return error.message;
  return fallback;
}

/** Escapes MySQL LIKE wildcards so search input cannot alter the pattern. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, char => `\\${char}`);
}

// ---------------------------------------------------------------------------
// Validation (server-side, never trust the frontend)
// ---------------------------------------------------------------------------

export const slugSchema = z
  .string()
  .trim()
  .min(1, "Slug is required")
  .max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with dashes");

const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO code")
  .default("USD");

const stringArraySchema = (maxItems: number, maxLength: number) =>
  z
    .array(z.string().trim().min(1).max(maxLength))
    .max(maxItems)
    .default([]);

/** Accepts "12.50" or 12.5, normalizes to a "12.50" decimal string. */
export const priceSchema = z.union([z.string(), z.number()]).transform((raw, ctx) => {
  const value = typeof raw === "string" ? Number(raw.trim()) : raw;
  if (!Number.isFinite(value) || value < 0 || value > 99999999.99) {
    ctx.addIssue({ code: "custom", message: "Price must be a non-negative amount" });
    return z.NEVER;
  }
  return value.toFixed(2);
});

const productStatusSchema = z.enum(["draft", "published", "archived"]);
const mockupSchema = z.enum(["book", "dashboard", "browser", "phone"]);
const formatSchema = z.enum(["standard", "story", "game"]);
const downloadTypeSchema = z.enum(["file", "external"]);

export const productCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(180),
  slug: slugSchema,
  description: z.string().trim().min(1, "Description is required"),
  shortDescription: z.string().trim().max(500).nullish(),
  price: priceSchema,
  currency: currencySchema,
  categoryId: z.number().int().positive("Category is required"),
  image: z.string().trim().max(500).nullish(),
  status: productStatusSchema.default("draft"),
  featured: z.boolean().default(false),
  downloadType: downloadTypeSchema.default("file"),
  features: stringArraySchema(100, 200),
  tags: stringArraySchema(50, 80),
  mockup: mockupSchema.default("book"),
  accent: z.string().trim().max(20).nullish(),
  checkoutUrl: z.string().trim().max(500).nullish(),
  priceNote: z.string().trim().max(120).nullish(),
  format: formatSchema.default("standard"),
  ageRange: z.string().trim().max(80).nullish(),
});

export const productUpdateSchema = productCreateSchema.partial().extend({
  id: z.number().int().positive(),
});

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  slug: slugSchema,
  description: z.string().trim().max(2000).nullish(),
});

export const categoryUpdateSchema = categoryCreateSchema.partial().extend({
  id: z.number().int().positive(),
});

/**
 * Storage keys are relative paths inside the private storage root
 * (PRIVATE_STORAGE_ROOT). Absolute paths, `..` segments and backslashes are
 * rejected to prevent path traversal outside the private directory.
 */
export function assertSafeStorageKey(storageKey: string): string {
  const key = storageKey.trim();
  if (!key || key.length > 500) throw new PublicSafeError("Invalid storage key");
  if (
    key.startsWith("/") ||
    key.includes("\\") ||
    key.includes("..") ||
    !/^[A-Za-z0-9._\-/]+$/.test(key)
  ) {
    throw new PublicSafeError("Invalid storage key");
  }
  return key;
}

export const assetCreateSchema = z.object({
  productId: z.number().int().positive(),
  fileName: z.string().trim().min(1, "File name is required").max(255),
  storageKey: z.string().trim().min(1, "Storage key is required").max(500),
  fileSize: z.number().int().nonnegative().max(10 * 1024 * 1024 * 1024).nullish(),
  mimeType: z.string().trim().max(120).nullish(),
  version: z.string().trim().min(1).max(40).default("1"),
});

export const assetUpdateSchema = assetCreateSchema
  .partial()
  .omit({ productId: true })
  .extend({ id: z.number().int().positive() });

// ---------------------------------------------------------------------------
// DB access
// ---------------------------------------------------------------------------

async function requireAdminDb() {
  const db = await getDb();
  if (!db) throw new Error("Database connection is required for this operation");
  return db;
}

type Db = Awaited<ReturnType<typeof requireAdminDb>>;

async function ensureCategoryExists(db: Db, categoryId: number) {
  const rows = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, categoryId)).limit(1);
  if (!rows[0]) throw new PublicSafeError("Category does not exist");
}

async function ensureSlugUnique(
  db: Db,
  slug: string,
  ignoreProductId?: number,
) {
  const rows = await db.select({ id: products.id }).from(products).where(eq(products.slug, slug)).limit(1);
  if (rows[0] && rows[0].id !== ignoreProductId) throw new PublicSafeError("Slug is already used by another product");
}

async function ensureCategorySlugUnique(db: Db, slug: string, ignoreCategoryId?: number) {
  const rows = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug)).limit(1);
  if (rows[0] && rows[0].id !== ignoreCategoryId) throw new PublicSafeError("Slug is already used by another category");
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getAdminDashboard() {
  const db = await requireAdminDb();
  const productCounts = await db
    .select({ status: products.status, total: count() })
    .from(products)
    .groupBy(products.status);
  const orderCounts = await db
    .select({ status: orders.status, total: count() })
    .from(orders)
    .groupBy(orders.status);
  const revenueRows = await db
    .select({ revenue: sql<string>`coalesce(sum(${orders.total}), 0)` })
    .from(orders)
    .where(eq(orders.paymentStatus, "paid"));
  const byStatus = (rows: Array<{ status: string; total: number }>, status: string) =>
    rows.find(row => row.status === status)?.total ?? 0;

  const totalProducts = productCounts.reduce((sum, row) => sum + row.total, 0);
  const publishedProducts = byStatus(productCounts, "published");
  const draftProducts = byStatus(productCounts, "draft");
  const totalOrders = orderCounts.reduce((sum, row) => sum + row.total, 0);
  return {
    products: {
      total: totalProducts,
      published: publishedProducts,
      draft: draftProducts,
      archived: byStatus(productCounts, "archived"),
    },
    orders: {
      total: totalOrders,
      paid: byStatus(orderCounts, "paid"),
      pending: byStatus(orderCounts, "pending"),
    },
    revenue: {
      paidTotal: Number(revenueRows[0]?.revenue ?? 0).toFixed(2),
    },
  };
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function listAdminProducts(input: { search?: string; status?: "draft" | "published" | "archived" }) {
  const db = await requireAdminDb();
  const conditions = [];
  if (input.status) conditions.push(eq(products.status, input.status));
  if (input.search?.trim()) {
    const pattern = `%${escapeLikePattern(input.search.trim())}%`;
    conditions.push(or(like(products.name, pattern), like(products.slug, pattern)));
  }
  const rows = await db
    .select({ product: products, categoryName: categories.name })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(products.updatedAt))
    .limit(200);
  return rows.map(row => ({ ...row.product, category: row.categoryName }));
}

export async function getAdminProductById(id: number) {
  const db = await requireAdminDb();
  const rows = await db
    .select({ product: products, categoryName: categories.name })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.id, id))
    .limit(1);
  if (!rows[0]) throw new PublicSafeError("Product not found");
  return { ...rows[0].product, category: rows[0].categoryName };
}

export async function createAdminProduct(input: z.infer<typeof productCreateSchema>) {
  const db = await requireAdminDb();
  await ensureCategoryExists(db, input.categoryId);
  await ensureSlugUnique(db, input.slug);
  const result = await db.insert(products).values({
    name: input.name,
    slug: input.slug,
    description: input.description,
    shortDescription: input.shortDescription ?? null,
    price: input.price,
    currency: input.currency,
    categoryId: input.categoryId,
    image: input.image ?? null,
    status: input.status,
    featured: input.featured ? 1 : 0,
    downloadType: input.downloadType,
    features: input.features,
    tags: input.tags,
    mockup: input.mockup,
    accent: input.accent ?? null,
    checkoutUrl: input.checkoutUrl ?? null,
    priceNote: input.priceNote ?? null,
    format: input.format,
    ageRange: input.ageRange ?? null,
  });
  return { id: getInsertId(result) };
}

export async function updateAdminProduct(input: z.infer<typeof productUpdateSchema>) {
  const db = await requireAdminDb();
  const existing = await db.select({ id: products.id }).from(products).where(eq(products.id, input.id)).limit(1);
  if (!existing[0]) throw new PublicSafeError("Product not found");
  if (input.categoryId !== undefined) await ensureCategoryExists(db, input.categoryId);
  if (input.slug !== undefined) await ensureSlugUnique(db, input.slug, input.id);
  const { id, featured, ...rest } = input;
  await db
    .update(products)
    .set({ ...rest, ...(featured !== undefined ? { featured: featured ? 1 : 0 } : {}) })
    .where(eq(products.id, id));
  return { id };
}

export async function setAdminProductStatus(id: number, status: "published" | "archived") {
  const db = await requireAdminDb();
  const existing = await db.select({ id: products.id }).from(products).where(eq(products.id, id)).limit(1);
  if (!existing[0]) throw new PublicSafeError("Product not found");
  await db.update(products).set({ status }).where(eq(products.id, id));
  return { id, status };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function listAdminCategories() {
  const db = await requireAdminDb();
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      createdAt: categories.createdAt,
      updatedAt: categories.updatedAt,
      productCount: sql<number>`count(${products.id})`,
    })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.name));
  return rows.map(row => ({ ...row, productCount: Number(row.productCount) }));
}

export async function createAdminCategory(input: z.infer<typeof categoryCreateSchema>) {
  const db = await requireAdminDb();
  await ensureCategorySlugUnique(db, input.slug);
  const result = await db
    .insert(categories)
    .values({ name: input.name, slug: input.slug, description: input.description ?? null });
  return { id: getInsertId(result) };
}

export async function updateAdminCategory(input: z.infer<typeof categoryUpdateSchema>) {
  const db = await requireAdminDb();
  const existing = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, input.id)).limit(1);
  if (!existing[0]) throw new PublicSafeError("Category not found");
  if (input.slug !== undefined) await ensureCategorySlugUnique(db, input.slug, input.id);
  const { id, ...rest } = input;
  await db.update(categories).set(rest).where(eq(categories.id, id));
  return { id };
}

/** Deletes a category only when no product references it. */
export async function deleteAdminCategory(id: number) {
  const db = await requireAdminDb();
  const existing = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, id)).limit(1);
  if (!existing[0]) throw new PublicSafeError("Category not found");
  const usage = await db.select({ total: count() }).from(products).where(eq(products.categoryId, id));
  if ((usage[0]?.total ?? 0) > 0) {
    throw new PublicSafeError("Category cannot be deleted while products still reference it");
  }
  await db.delete(categories).where(eq(categories.id, id));
  return { id };
}

// ---------------------------------------------------------------------------
// Orders (read-only: paid status is owned exclusively by the Stripe webhook)
// ---------------------------------------------------------------------------

export async function listAdminOrders(input: { limit?: number; offset?: number }) {
  const db = await requireAdminDb();
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const offset = Math.max(input.offset ?? 0, 0);
  const rows = await db
    .select({ order: orders, customerEmail: customers.email, customerName: customers.name })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .orderBy(desc(orders.createdAt))
    .limit(limit)
    .offset(offset);
  const totals = await db.select({ total: count() }).from(orders);
  const itemCounts = await db
    .select({ orderId: orderItems.orderId, itemCount: sql<number>`sum(${orderItems.quantity})` })
    .from(orderItems)
    .groupBy(orderItems.orderId);
  const countByOrder = new Map(itemCounts.map(row => [row.orderId, Number(row.itemCount)]));
  return {
    total: totals[0]?.total ?? 0,
    // The guest capability token (`accessToken`) is stripped: it is only
    // ever revealed to the buyer at order creation and must not fan out to
    // other surfaces, even admin ones.
    orders: rows.map(row => {
      const { accessToken: _capability, ...safeOrder } = row.order;
      return {
        ...safeOrder,
        customerEmail: row.customerEmail,
        customerName: row.customerName,
        itemCount: countByOrder.get(row.order.id) ?? 0,
      };
    }),
  };
}

export async function getAdminOrderById(id: number) {
  const db = await requireAdminDb();
  const rows = await db
    .select({ order: orders, customer: customers })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) throw new PublicSafeError("Order not found");
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  // The guest capability token (`accessToken`) is stripped here as well: it
  // is only ever revealed to the buyer at order creation.
  const { accessToken: _capability, ...safeOrder } = row.order;
  return {
    order: {
      ...safeOrder,
      // Only non-sensitive Stripe metadata is exposed: provider name and the
      // checkout session reference. No secrets are stored or returned.
      stripe: {
        provider: row.order.paymentProvider,
        reference: row.order.paymentReference,
      },
    },
    customer: {
      id: row.customer.id,
      email: row.customer.email,
      name: row.customer.name,
    },
    items,
  };
}

// ---------------------------------------------------------------------------
// Digital assets (metadata only; premium files stay in private storage)
// ---------------------------------------------------------------------------

// NOTE: `storageKey` is returned here because the admin UI needs it to manage
// assets. This procedure is admin-only (adminProcedure) and `storageKey` is
// never exposed through any public procedure.
export async function listAdminAssets(productId: number) {
  const db = await requireAdminDb();
  const product = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1);
  if (!product[0]) throw new PublicSafeError("Product not found");
  const rows = await db.select().from(digitalAssets).where(eq(digitalAssets.productId, productId)).orderBy(desc(digitalAssets.updatedAt));
  const withPresence = await Promise.all(
    rows.map(async asset => ({ ...asset, filePresent: await storage.exists(asset.storageKey) })),
  );
  return withPresence;
}

export async function createAdminAsset(input: z.infer<typeof assetCreateSchema>) {
  const db = await requireAdminDb();
  const product = await db.select({ id: products.id }).from(products).where(eq(products.id, input.productId)).limit(1);
  if (!product[0]) throw new PublicSafeError("Product not found");
  const storageKey = assertSafeStorageKey(input.storageKey);
  const result = await db.insert(digitalAssets).values({
    productId: input.productId,
    fileName: input.fileName,
    storageKey,
    fileSize: input.fileSize ?? null,
    mimeType: input.mimeType ?? null,
    version: input.version,
  });
  return {
    id: getInsertId(result),
    filePresent: await storage.exists(storageKey),
  };
}

export async function updateAdminAsset(input: z.infer<typeof assetUpdateSchema>) {
  const db = await requireAdminDb();
  const existing = await db.select().from(digitalAssets).where(eq(digitalAssets.id, input.id)).limit(1);
  if (!existing[0]) throw new PublicSafeError("Digital asset not found");
  const { id, storageKey, ...rest } = input;
  await db
    .update(digitalAssets)
    .set({ ...rest, ...(storageKey !== undefined ? { storageKey: assertSafeStorageKey(storageKey) } : {}) })
    .where(eq(digitalAssets.id, id));
  return { id };
}

/** Deletes an asset only when no download grant references it. */
export async function deleteAdminAsset(id: number) {
  const db = await requireAdminDb();
  const existing = await db.select().from(digitalAssets).where(eq(digitalAssets.id, id)).limit(1);
  if (!existing[0]) throw new PublicSafeError("Digital asset not found");
  const usage = await db.select({ total: count() }).from(downloads).where(eq(downloads.assetId, id));
  if ((usage[0]?.total ?? 0) > 0) {
    throw new PublicSafeError("Digital asset cannot be deleted while download grants still reference it");
  }
  await db.delete(digitalAssets).where(eq(digitalAssets.id, id));
  return { id };
}
