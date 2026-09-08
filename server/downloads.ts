import { createHash, randomBytes } from "node:crypto";
import Stripe from "stripe";
import { and, eq, gt, sql } from "drizzle-orm";
import { digitalAssets, downloads, orderItems, orders } from "../drizzle/schema";
import { ENV, requireEnv } from "./_core/env";
import { getAffectedRows, getDb } from "./db";
import { storage } from "./storage";

const ACCESS_TTL_MS = 60 * 60 * 1000;

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

function getStripe() {
  return new Stripe(requireEnv("STRIPE_SECRET_KEY", ENV.stripeSecretKey));
}

export async function listDownloadAccess(sessionId: string) {
  const stripeSession = await getStripe().checkout.sessions.retrieve(sessionId);
  if (stripeSession.payment_status !== "paid") throw new Error("Payment is not confirmed");
  const orderId = Number(stripeSession.metadata?.orderId);
  if (!Number.isInteger(orderId) || orderId < 1) throw new Error("Invalid payment session");

  const db = await getDb();
  if (!db) throw new Error("Database connection is required for downloads");
  const orderRows = await db
    .select({ order: orders })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.status, "paid"), eq(orders.paymentStatus, "paid")))
    .limit(1);
  const order = orderRows[0]?.order;
  if (!order) throw new Error("Payment is still being confirmed");

  const assets = await db
    .select({ item: orderItems, asset: digitalAssets })
    .from(orderItems)
    .innerJoin(digitalAssets, eq(digitalAssets.productId, orderItems.productId))
    .where(eq(orderItems.orderId, orderId));

  console.info("[Downloads] Preparing access", {
    orderId,
    assetCount: assets.length,
  });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ACCESS_TTL_MS);
  const access = [];
  for (const row of assets) {
    const filePresent = await storage.exists(row.asset.storageKey);
    console.info("[Downloads] Asset lookup", {
      productId: row.item.productId,
      assetId: row.asset.id,
      storageKey: row.asset.storageKey,
      filePresent,
    });
    if (!filePresent) {
      throw new Error("Digital asset is unavailable");
    }
    // One active grant per (order, asset): revoke previous tokens first so
    // repeated success-page visits cannot accumulate unlimited live URLs.
    await db
      .delete(downloads)
      .where(and(eq(downloads.orderId, orderId), eq(downloads.assetId, row.asset.id)));
    const rawToken = randomBytes(32).toString("hex");
    await db.insert(downloads).values({
      orderId,
      customerId: order.customerId,
      productId: row.item.productId,
      assetId: row.asset.id,
      tokenHash: hashToken(rawToken),
      expiresAt,
    });
    access.push({
      productName: row.item.productNameSnapshot,
      fileName: row.asset.fileName,
      fileSize: row.asset.fileSize,
      mimeType: row.asset.mimeType,
      version: row.asset.version,
      expiresAt: expiresAt.toISOString(),
      url: `/api/download/${rawToken}`,
    });
  }
  console.info("[Downloads] Access grants generated", {
    orderId,
    grantCount: access.length,
  });
  return { orderId, access };
}

export async function downloadAsset(rawToken: string) {
  if (!rawToken || rawToken.length > 512) throw new Error("Download access is invalid or expired");
  const db = await getDb();
  if (!db) throw new Error("Database connection is required for downloads");
  // Atomically consume one download: the counter increment, the remaining
  // quota check and the expiry check happen in a single UPDATE, so N
  // concurrent requests can never push usage past maxDownloads.
  const claimed = await db.update(downloads).set({
    downloadCount: sql`${downloads.downloadCount} + 1`,
    lastDownloadedAt: new Date(),
  }).where(and(
    eq(downloads.tokenHash, hashToken(rawToken)),
    gt(downloads.expiresAt, new Date()),
    sql`${downloads.downloadCount} < ${downloads.maxDownloads}`,
  ));
  if (getAffectedRows(claimed) !== 1) {
    throw new Error("Download access is invalid or expired");
  }
  const rows = await db
    .select({ access: downloads, asset: digitalAssets, order: orders })
    .from(downloads)
    .innerJoin(digitalAssets, eq(downloads.assetId, digitalAssets.id))
    .innerJoin(orders, eq(downloads.orderId, orders.id))
    .where(and(
      eq(downloads.tokenHash, hashToken(rawToken)),
      eq(orders.status, "paid"),
      eq(orders.paymentStatus, "paid"),
    ))
    .limit(1);
  const row = rows[0];
  if (!row) {
    // Order is no longer paid (or asset/grant vanished): the consumed slot
    // stays consumed rather than handing out a file.
    throw new Error("Download access is invalid or expired");
  }
  if (!(await storage.exists(row.asset.storageKey))) throw new Error("Digital asset is unavailable");
  return storage.download(row.asset.storageKey, {
    fileName: row.asset.fileName,
    mimeType: row.asset.mimeType,
    fileSize: row.asset.fileSize,
  });
}
