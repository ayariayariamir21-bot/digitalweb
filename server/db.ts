import { asc, and, eq, inArray } from "drizzle-orm";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import {
  categories,
  contactMessages,
  customers,
  orderItems,
  orders,
  InsertUser,
  products,
  subscribers,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); } catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

async function getRequiredDb() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database connection is required for this operation");
  }
  return db;
}

/**
 * Raw write-result header of the mysql2 driver.
 *
 * ETAPE 11 fix (CRITICAL): drizzle-orm's mysql2 session returns the RAW
 * driver result for writes (`client.query(...)` → `[header, fields]`), so
 * `insertId`/`affectedRows` live on element `[0]`, NOT on the result object
 * itself. Reading `.insertId` directly yields `undefined` → `NaN` order ids
 * (order creation impossible) and `NaN !== 1` affected-rows checks (every
 * download rejected). These helpers accept both shapes so the mapping stays
 * correct regardless of driver/session wrapping.
 */
type WriteResultHeader = { insertId?: unknown; affectedRows?: unknown };

function writeHeaderOf(result: unknown): WriteResultHeader {
  if (Array.isArray(result)) return (result[0] as WriteResultHeader) ?? {};
  return (result as WriteResultHeader) ?? {};
}

/** Extracts the auto-increment id of an INSERT (NaN when unavailable). */
export function getInsertId(result: unknown): number {
  return Number(writeHeaderOf(result).insertId);
}

/** Extracts the affected-rows count of an UPDATE/DELETE (NaN when unavailable). */
export function getAffectedRows(result: unknown): number {
  return Number(writeHeaderOf(result).affectedRows);
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => { const value = user[field]; if (value === undefined) return; const normalized = value ?? null; values[field] = normalized; updateSet[field] = normalized; };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; } else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function addSubscriber(email: string) {
  const db = await getRequiredDb();
  await db.insert(subscribers).values({ email, source: "website" }).onDuplicateKeyUpdate({ set: { email } });
}

export async function addContactMessage(input: { name: string; email: string; subject: string; message: string }) {
  const db = await getRequiredDb();
  await db.insert(contactMessages).values(input);
}

export async function listProducts() {
  const db = await getRequiredDb();
  const rows = await db
    .select({ product: products, category: categories.name })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.status, "published"))
    .orderBy(asc(products.name));
  return rows.map(row => ({ ...row.product, category: row.category }));
}

export async function getProductBySlug(slug: string) {
  const db = await getRequiredDb();
  const result = await db
    .select({ product: products, category: categories.name })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.slug, slug))
    .limit(1);
  return result[0] ? { ...result[0].product, category: result[0].category } : undefined;
}

export async function getFeaturedProducts() {
  const db = await getRequiredDb();
  const rows = await db
    .select({ product: products, category: categories.name })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.status, "published"), eq(products.featured, 1)))
    .orderBy(asc(products.name));
  return rows.map(row => ({ ...row.product, category: row.category }));
}

export async function listCategories() {
  const db = await getRequiredDb();
  return db.select().from(categories).orderBy(asc(categories.name));
}

export async function createGuestOrder(input: {
  email: string;
  name?: string;
  items: Array<{ productId: number; quantity: number }>;
  userId?: number | null;
}) {
  const db = await getRequiredDb();
  const productIds = Array.from(new Set(input.items.map(item => item.productId)));
  const rows = await db.select().from(products).where(and(inArray(products.id, productIds), eq(products.status, "published")));
  if (rows.length !== productIds.length) throw new Error("One or more products are unavailable");
  const byId = new Map(rows.map(product => [product.id, product]));
  const quantities = new Map<number, number>();
  for (const item of input.items) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  const resolved = Array.from(quantities, ([productId, quantity]) => {
    const product = byId.get(productId);
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new Error("Invalid order item");
    return { product, quantity };
  });
  const currency = rows[0]?.currency ?? "USD";
  if (rows.some(product => product.currency !== currency)) throw new Error("Mixed currencies are not supported");
  const cents = (value: string | number) => Math.round(Number(value) * 100);
  const subtotalCents = resolved.reduce((sum, item) => sum + cents(item.product.price) * item.quantity, 0);
  // Unguessable capability token: the only proof that the caller created this
  // guest order. Required later to open a Stripe checkout session for it.
  const accessToken = randomBytes(32).toString("hex");
  const result = await db.transaction(async tx => {
    await tx.insert(customers).values({
      email: input.email,
      name: input.name ?? null,
      userId: input.userId ?? null,
    }).onDuplicateKeyUpdate({ set: { name: input.name ?? null, ...(input.userId ? { userId: input.userId } : {}) } });
    const customerRows = await tx.select().from(customers).where(eq(customers.email, input.email)).limit(1);
    const customer = customerRows[0];
    if (!customer) throw new Error("Customer could not be created");
    const orderInsert = await tx.insert(orders).values({
      customerId: customer.id,
      status: "pending",
      paymentStatus: "pending",
      subtotal: (subtotalCents / 100).toFixed(2),
      discount: "0.00",
      total: (subtotalCents / 100).toFixed(2),
      currency,
      accessToken,
    });
    const orderId = getInsertId(orderInsert);
    if (!Number.isSafeInteger(orderId) || orderId < 1) throw new Error("Order could not be created");
    await tx.insert(orderItems).values(resolved.map(item => ({
      orderId,
      productId: item.product.id,
      productNameSnapshot: item.product.name,
      unitPrice: Number(item.product.price).toFixed(2),
      quantity: item.quantity,
      total: (cents(item.product.price) * item.quantity / 100).toFixed(2),
    })));
    return {
      orderId,
      accessToken,
      total: (subtotalCents / 100).toFixed(2),
      currency,
      itemCount: resolved.reduce((sum, item) => sum + item.quantity, 0),
    };
  });
  return result;
}

/**
 * Compares the order capability token in constant time.
 *
 * ETAPE 10 rule: every order that may open a NEW Stripe Checkout Session
 * must carry a valid (non-NULL, unguessable) access token minted at order
 * creation with `randomBytes(32)`. Legacy rows with accessToken NULL are
 * INVALIDATED: they can never open a checkout session again. NULL tokens
 * are never backfilled with a predictable value.
 */
export function isOrderTokenValid(storedToken: string | null, providedToken?: string): boolean {
  if (storedToken === null || storedToken === "") return false;
  if (!providedToken || providedToken.length !== storedToken.length) return false;
  return timingSafeEqual(Buffer.from(providedToken), Buffer.from(storedToken));
}

/**
 * Internal server-side order lookup (webhook only).
 *
 * Unlike `getOrderForPayment`, this does NOT require the guest capability
 * token: the caller is the verified Stripe webhook (signature checked in
 * `handleStripeWebhook`), not the unauthenticated browser. Amount, currency
 * and existence are then re-checked against the retrieved order before any
 * state change.
 */
export async function getOrderForWebhook(orderId: number) {
  const db = await getRequiredDb();
  const orderRows = await db
    .select({ order: orders, customer: customers })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.id, orderId))
    .limit(1);
  const orderRow = orderRows[0];
  if (!orderRow) return undefined;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  return { ...orderRow, items };
}

export async function getOrderForPayment(orderId: number, accessToken?: string) {
  const orderRow = await getOrderForWebhook(orderId);
  if (!orderRow) return undefined;
  // Same error as "not found": never reveal whether an order id exists.
  if (!isOrderTokenValid(orderRow.order.accessToken, accessToken)) return undefined;
  return orderRow;
}

export async function attachPaymentReference(orderId: number, paymentReference: string) {
  const db = await getRequiredDb();
  await db
    .update(orders)
    .set({ paymentProvider: "stripe", paymentReference })
    .where(and(
      eq(orders.id, orderId),
      eq(orders.status, "pending"),
      eq(orders.paymentStatus, "pending"),
    ));
}

export async function markOrderPaid(orderId: number, paymentReference: string) {
  const db = await getRequiredDb();
  // Both guards together make webhook handling idempotent and prevent a late
  // event from flipping a cancelled/refunded order back to paid.
  await db
    .update(orders)
    .set({
      status: "paid",
      paymentStatus: "paid",
      paymentProvider: "stripe",
      paymentReference,
    })
    .where(and(
      eq(orders.id, orderId),
      eq(orders.status, "pending"),
      eq(orders.paymentStatus, "pending"),
    ));
}
