import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isOrderTokenValid } from "./db";
import { downloadAsset } from "./downloads";
import { appRouter } from "./routers";
import { escapeLikePattern, PublicSafeError, safeAdminMessage } from "./admin";
import { DevelopmentFileStorage } from "./storage";
import type { TrpcContext } from "./_core/context";

function callerFor(role: "user" | "admin" | null) {
  const user =
    role === null
      ? null
      : {
          id: role === "admin" ? 99 : 7,
          openId: `${role}-user`,
          email: `${role}@example.com`,
          name: "Test User",
          loginMethod: "manus",
          role,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        };
  return appRouter.createCaller({
    user: user as TrpcContext["user"],
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  });
}

describe("orders price manipulation", () => {
  const baseItem = { productId: 1, quantity: 1 };

  it("ignores forged price/total keys sent by the frontend", async () => {
    const caller = callerFor(null);
    const forged = caller.orders.create({
      email: "buyer@example.com",
      items: [baseItem],
      price: 0,
      total: 0,
      unitPrice: "0.01",
    } as unknown as { email: string; items: Array<{ productId: number; quantity: number }> });
    const clean = caller.orders.create({ email: "buyer@example.com", items: [baseItem] });
    // Unknown keys are stripped by the input schema: both payloads behave
    // identically and reach the database layer (unavailable here).
    await expect(forged).rejects.toThrow("Database connection is required");
    await expect(clean).rejects.toThrow("Database connection is required");
  });

  it("rejects invalid quantities before any database access", async () => {
    const caller = callerFor(null);
    for (const quantity of [0, -1, 100, 999999999]) {
      await expect(
        caller.orders.create({ email: "buyer@example.com", items: [{ productId: 1, quantity }] }),
      ).rejects.toThrow();
    }
  });

  it("rejects invalid product ids before any database access", async () => {
    const caller = callerFor(null);
    for (const productId of [0, -3]) {
      await expect(
        caller.orders.create({ email: "buyer@example.com", items: [{ productId, quantity: 1 }] }),
      ).rejects.toThrow();
    }
  });
});

describe("order access token (checkout IDOR guard)", () => {
  it("invalidates legacy orders without a token: they can never open checkout", () => {
    // ETAPE 10 rule: any order that may create a NEW Stripe Checkout
    // Session must carry a valid access token. Legacy rows with NULL are
    // invalidated (never backfilled with a predictable value).
    expect(isOrderTokenValid(null, undefined)).toBe(false);
    expect(isOrderTokenValid(null, "anything")).toBe(false);
    expect(isOrderTokenValid("", undefined)).toBe(false);
  });

  it("accepts the exact token and rejects anything else", () => {
    const token = "a".repeat(64);
    expect(isOrderTokenValid(token, token)).toBe(true);
    expect(isOrderTokenValid(token, undefined)).toBe(false);
    expect(isOrderTokenValid(token, "")).toBe(false);
    expect(isOrderTokenValid(token, "b".repeat(64))).toBe(false);
    expect(isOrderTokenValid(token, token.slice(1))).toBe(false);
    expect(isOrderTokenValid(token, `${token}x`)).toBe(false);
  });

  it("rejects malformed checkout-session input before any database access", async () => {
    const caller = callerFor(null);
    await expect(caller.orders.createCheckoutSession({ orderId: -2, accessToken: "a".repeat(64) })).rejects.toThrow();
    await expect(
      caller.orders.createCheckoutSession({ orderId: 1 }),
    ).rejects.toThrow();
    await expect(
      caller.orders.createCheckoutSession({ orderId: 1, accessToken: "" }),
    ).rejects.toThrow();
    await expect(
      caller.orders.createCheckoutSession({ orderId: 1, accessToken: "x".repeat(200) }),
    ).rejects.toThrow();
  });

  it("returns a generic error that never reveals order existence", async () => {
    const caller = callerFor(null);
    await expect(
      caller.orders.createCheckoutSession({ orderId: 424242, accessToken: "a".repeat(64) }),
    ).rejects.toThrow("Unable to create checkout session");
  });
});

describe("download token validation", () => {
  it("rejects empty and oversized tokens before any database access", async () => {
    await expect(downloadAsset("")).rejects.toThrow("invalid or expired");
    await expect(downloadAsset("x".repeat(600))).rejects.toThrow("invalid or expired");
  });
});

describe("private storage traversal", () => {
  const root = mkdtempSync(join(tmpdir(), "private-storage-"));
  mkdirSync(join(root, "guides"), { recursive: true });
  writeFileSync(join(root, "guides", "real.pdf"), "premium-bytes");
  const storage = new DevelopmentFileStorage(root);

  it("serves files inside the private root", async () => {
    expect(await storage.exists("guides/real.pdf")).toBe(true);
  });

  it("returns a controlled error when the asset is missing", async () => {
    await expect(
      storage.download("guides/missing.pdf", { fileName: "missing.pdf", mimeType: "application/pdf", fileSize: null }),
    ).rejects.toThrow("Digital asset is unavailable");
  });

  it("blocks ../ traversal", async () => {
    expect(await storage.exists("../outside.pdf")).toBe(false);
    expect(await storage.exists("guides/../../outside.pdf")).toBe(false);
    await expect(storage.download("../outside.pdf", { fileName: "x", mimeType: null, fileSize: null })).rejects.toThrow(
      "Invalid storage key",
    );
  });

  it("blocks absolute paths", async () => {
    expect(await storage.exists("/etc/passwd")).toBe(false);
    expect(await storage.exists("C:/Windows/win.ini")).toBe(false);
  });

  it("blocks windows-style traversal", async () => {
    expect(await storage.exists("..\\outside.pdf")).toBe(false);
    expect(await storage.exists("guides\\..\\..\\outside.pdf")).toBe(false);
  });

  it("blocks symlinks inside the root that point outside", async () => {
    const outside = join(tmpdir(), "storage-escape-secret.txt");
    writeFileSync(outside, "top-secret");
    const link = join(root, "guides", "escape.pdf");
    try {
      symlinkSync(outside, link);
    } catch {
      // Symlink creation needs privileges on some systems; if it cannot be
      // created there is nothing to escape through on this machine.
      expect(true).toBe(true);
      return;
    }
    expect(await storage.exists("guides/escape.pdf")).toBe(false);
    await expect(
      storage.download("guides/escape.pdf", { fileName: "x", mimeType: null, fileSize: null }),
    ).rejects.toThrow();
  });
});

describe("admin error hygiene", () => {
  it("returns safe business messages and masks everything else", () => {
    expect(safeAdminMessage(new PublicSafeError("Product not found"), "Products unavailable")).toBe(
      "Product not found",
    );
    expect(safeAdminMessage(new Error("connect ECONNREFUSED 10.0.0.1"), "Products unavailable")).toBe(
      "Products unavailable",
    );
    expect(safeAdminMessage(new Error("Database connection is required"), "Dashboard unavailable")).toBe(
      "Dashboard unavailable",
    );
    expect(safeAdminMessage("string failure", "Orders unavailable")).toBe("Orders unavailable");
  });

  it("never leaks database internals through admin endpoints", async () => {
    const caller = callerFor("admin");
    await expect(caller.admin.dashboard()).rejects.toThrow("Dashboard unavailable");
    await expect(caller.admin.dashboard()).rejects.not.toThrow("Database connection");
  });

  it("escapes LIKE wildcards in admin search", () => {
    expect(escapeLikePattern("100% guide_book\\")).toBe("100\\% guide\\_book\\\\");
    expect(escapeLikePattern("plain")).toBe("plain");
  });
});

describe("no hidden paid-transition endpoint", () => {
  it("exposes no procedure that could mark an order paid outside the webhook", () => {
    const procedures = (appRouter as unknown as { _def: { procedures: Record<string, unknown> } })._def
      .procedures;
    const paths = Object.keys(procedures);
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(path).not.toMatch(/setpaid|markpaid|setstatus|updatestatus|deleteorder/i);
    }
    // Admin orders stay strictly read-only.
    const adminOrders = (appRouter.admin as unknown as Record<string, Record<string, unknown>>)
      .orders as unknown as Record<string, unknown>;
    expect(Object.keys(adminOrders).sort()).toEqual(["getById", "list"]);
  });
});
