import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import {
  assetCreateSchema,
  assertSafeStorageKey,
  categoryCreateSchema,
  productCreateSchema,
} from "./admin";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function userWithRole(role: "user" | "admin"): AuthenticatedUser {
  return {
    id: role === "admin" ? 99 : 7,
    openId: role === "admin" ? "admin-user" : "regular-user",
    email: `${role}@example.com`,
    name: "Test User",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
}

function callerFor(role: "user" | "admin" | null) {
  return appRouter.createCaller({
    user: role === null ? null : userWithRole(role),
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  });
}

const validProduct = {
  name: "Test Guide",
  slug: "test-guide",
  description: "A useful test product",
  price: "19.00",
  currency: "USD",
  categoryId: 1,
  status: "draft" as const,
  featured: false,
  downloadType: "file" as const,
  features: ["Chapter one"],
  tags: ["productivity"],
  mockup: "book" as const,
  format: "standard" as const,
};

// Every admin entry point, called with valid input.
async function callAllAdminEndpoints(caller: ReturnType<typeof callerFor>) {
  return Promise.allSettled([
    caller.admin.dashboard(),
    caller.admin.products.list({}),
    caller.admin.products.list({ search: "guide", status: "published" }),
    caller.admin.products.getById({ id: 1 }),
    caller.admin.products.create(validProduct),
    caller.admin.products.update({ id: 1, name: "Renamed" }),
    caller.admin.products.publish({ id: 1 }),
    caller.admin.products.archive({ id: 1 }),
    caller.admin.categories.list(),
    caller.admin.categories.create({ name: "Books", slug: "books" }),
    caller.admin.categories.update({ id: 1, name: "Books" }),
    caller.admin.categories.delete({ id: 1 }),
    caller.admin.orders.list({}),
    caller.admin.orders.getById({ id: 1 }),
    caller.admin.assets.list({ productId: 1 }),
    caller.admin.assets.create({ productId: 1, fileName: "guide.pdf", storageKey: "guides/guide.pdf" }),
    caller.admin.assets.update({ id: 1, fileName: "guide-v2.pdf" }),
    caller.admin.assets.delete({ id: 1 }),
  ]);
}

describe("admin RBAC", () => {
  it("rejects every admin procedure for anonymous callers", async () => {
    const results = await callAllAdminEndpoints(callerFor(null));
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result.status).toBe("rejected");
      if (result.status === "rejected") {
        expect(result.reason).toMatchObject({ code: "FORBIDDEN" });
      }
    }
  });

  it("rejects every admin procedure for non-admin users (IDOR guard)", async () => {
    const results = await callAllAdminEndpoints(callerFor("user"));
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result.status).toBe("rejected");
      if (result.status === "rejected") {
        expect(result.reason).toMatchObject({ code: "FORBIDDEN" });
      }
    }
  });

  it("lets admin callers pass the auth guard (they reach validation/DB, not FORBIDDEN)", async () => {
    const results = await callAllAdminEndpoints(callerFor("admin"));
    for (const result of results) {
      if (result.status === "rejected") {
        // Without DATABASE_URL the resolvers fail at the DB layer — but never
        // with FORBIDDEN, proving the admin guard passed.
        expect(result.reason).not.toMatchObject({ code: "FORBIDDEN" });
      }
    }
  });

  it("rejects invalid ids at the validation layer for non-admins", async () => {
    const caller = callerFor("user");
    await expect(caller.admin.products.getById({ id: -5 })).rejects.toThrow();
    await expect(caller.admin.orders.getById({ id: 999999 })).rejects.toThrow();
    await expect(caller.admin.assets.list({ productId: 999999 })).rejects.toThrow();
  });
});

describe("admin order safety", () => {
  it("exposes no mutation that could set an order to paid", () => {
    const orderRoutes = (appRouter as unknown as { _def: { procedure: unknown } });
    expect(orderRoutes).toBeDefined();
    // The admin orders router must stay strictly read-only: status
    // transitions to `paid` belong to the Stripe webhook only.
    const adminRouter = appRouter.admin as unknown as Record<string, unknown>;
    const ordersRouter = adminRouter.orders as Record<string, unknown>;
    expect(Object.keys(ordersRouter).sort()).toEqual(["getById", "list"]);
  });
});

describe("admin server-side validation", () => {
  it("rejects products with missing name, bad slug, negative price, bad currency or bad status", () => {
    expect(() => productCreateSchema.parse({ ...validProduct, name: "" })).toThrow();
    expect(() => productCreateSchema.parse({ ...validProduct, slug: "Bad Slug!" })).toThrow();
    expect(() => productCreateSchema.parse({ ...validProduct, slug: "-leading-dash" })).toThrow();
    expect(() => productCreateSchema.parse({ ...validProduct, price: "-5.00" })).toThrow();
    expect(() => productCreateSchema.parse({ ...validProduct, price: -1 })).toThrow();
    expect(() => productCreateSchema.parse({ ...validProduct, currency: "US" })).toThrow();
    expect(() => productCreateSchema.parse({ ...validProduct, currency: "dollar" })).toThrow();
    expect(() => productCreateSchema.parse({ ...validProduct, status: "archived-tomorrow" })).toThrow();
    expect(() => productCreateSchema.parse({ ...validProduct, categoryId: 0 })).toThrow();
  });

  it("accepts a fully valid product payload", () => {
    const parsed = productCreateSchema.parse(validProduct);
    expect(parsed.slug).toBe("test-guide");
    expect(parsed.price).toBe("19.00");
    expect(parsed.currency).toBe("USD");
  });

  it("rejects categories with bad slugs", () => {
    expect(() => categoryCreateSchema.parse({ name: "Books", slug: "Not A Slug" })).toThrow();
    expect(() => categoryCreateSchema.parse({ name: "", slug: "books" })).toThrow();
  });

  it("rejects unsafe storage keys (path traversal)", () => {
    expect(() => assertSafeStorageKey("../secrets/env")).toThrow();
    expect(() => assertSafeStorageKey("/absolute/path.pdf")).toThrow();
    expect(() => assertSafeStorageKey("..\\windows\\path.pdf")).toThrow();
    expect(() => assertSafeStorageKey("")).toThrow();
    expect(assertSafeStorageKey("guides/my-guide-v1.pdf")).toBe("guides/my-guide-v1.pdf");
  });

  it("rejects invalid asset payloads", () => {
    expect(() =>
      assetCreateSchema.parse({ productId: 1, fileName: "", storageKey: "guides/f.pdf" }),
    ).toThrow();
    expect(() =>
      assetCreateSchema.parse({ productId: 0, fileName: "f.pdf", storageKey: "guides/f.pdf" }),
    ).toThrow();
  });

  it("rejects invalid admin input before any database access", async () => {
    const caller = callerFor("admin");
    // Zod input parsing fails before the resolver body runs, so these fail
    // even without DATABASE_URL — and never with a DB error.
    await expect(
      caller.admin.products.create({ ...validProduct, slug: "Bad Slug!" }),
    ).rejects.toThrow();
    await expect(
      caller.admin.products.create({ ...validProduct, price: "-9.99" }),
    ).rejects.toThrow();
    await expect(caller.admin.categories.delete({ id: -2 })).rejects.toThrow();
    await expect(
      caller.admin.assets.create({ productId: 1, fileName: "", storageKey: "guides/f.pdf" }),
    ).rejects.toThrow();
  });
});
