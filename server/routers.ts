import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import {
  addContactMessage,
  addSubscriber,
  getFeaturedProducts,
  getProductBySlug,
  listCategories,
  listProducts,
  createGuestOrder,
} from "./db";
import {
  assetCreateSchema,
  assetUpdateSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  createAdminAsset,
  createAdminCategory,
  createAdminProduct,
  deleteAdminAsset,
  deleteAdminCategory,
  getAdminDashboard,
  getAdminOrderById,
  getAdminProductById,
  listAdminAssets,
  listAdminCategories,
  listAdminOrders,
  listAdminProducts,
  productCreateSchema,
  productUpdateSchema,
  setAdminProductStatus,
  safeAdminMessage,
  updateAdminAsset,
  updateAdminCategory,
  updateAdminProduct,
} from "./admin";
import { createStripeCheckoutSession } from "./payments";
import { listDownloadAccess } from "./downloads";
import { consumeRateLimit } from "./_core/rateLimit";

function trpcClientKey(ctx: { req?: { ip?: string; headers?: Record<string, unknown>; socket?: { remoteAddress?: string } } }): string {
  const req = ctx.req as unknown as { ip?: string; headers?: Record<string, string | string[]>; socket?: { remoteAddress?: string } } | undefined;
  const forwarded = req?.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return req?.ip || req?.socket?.remoteAddress || "unknown";
}

/**
 * ETAPE 10 rate limits (documented in docs/production-readiness.md):
 * - orders.create: 30 / 10 min / IP (anti order-spam)
 * - orders.createCheckoutSession: 60 / 10 min / IP (anti brute-force)
 * Throws a generic BAD_REQUEST-shaped FORBIDDEN on excess so callers cannot
 * distinguish throttling from refusal reasons.
 */
function checkOrderRateLimit(ctx: { req?: unknown }, bucket: string, max: number) {
  const key = trpcClientKey(ctx as never);
  const allowed = consumeRateLimit(bucket, key, { windowMs: 10 * 60 * 1000, max });
  if (!allowed) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many requests, please retry later" });
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  marketing: router({
    subscribe: publicProcedure.input(z.object({ email: z.string().email() })).mutation(async ({ input }) => {
      await addSubscriber(input.email.toLowerCase());
      return { success: true } as const;
    }),
    contact: publicProcedure.input(z.object({ name: z.string().min(1).max(160), email: z.string().email(), topic: z.string().min(1).max(80), message: z.string().min(1).max(5000) })).mutation(async ({ input }) => {
      await addContactMessage({ ...input, subject: input.topic });
      return { success: true } as const;
    }),
  }),
  products: router({
    list: publicProcedure.query(() => listProducts()),
    getBySlug: publicProcedure
      .input(z.object({ slug: z.string().min(1).max(180) }))
      .query(async ({ input }) => {
        const product = await getProductBySlug(input.slug);
        if (!product || product.status !== "published") {
          throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
        }
        return product;
      }),
    getFeatured: publicProcedure.query(() => getFeaturedProducts()),
  }),
  categories: router({
    list: publicProcedure.query(() => listCategories()),
  }),
  orders: router({
    create: publicProcedure.input(z.object({
      email: z.string().trim().email().max(320),
      name: z.string().trim().max(160).optional(),
      items: z.array(z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(99),
      })).min(1).max(100),
    })).mutation(async ({ input, ctx }) => {
      checkOrderRateLimit(ctx, "trpc:orders.create", 30);
      try {
        return await createGuestOrder({ ...input, email: input.email.toLowerCase(), userId: ctx.user?.id });
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Unable to create order" });
      }
    }),
    createCheckoutSession: publicProcedure.input(z.object({
      orderId: z.number().int().positive(),
      // Capability token returned at order creation. Required, no exception:
      // legacy orders with accessToken NULL are invalidated and can never
      // open a new checkout session.
      accessToken: z.string().trim().min(1).max(128),
    })).mutation(async ({ input, ctx }) => {
      checkOrderRateLimit(ctx, "trpc:orders.createCheckoutSession", 60);
      try {
        return await createStripeCheckoutSession(input.orderId, input.accessToken);
      } catch (error) {
        // Never reveal whether an order id exists or why it was refused.
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unable to create checkout session" });
      }
    }),
  }),
  downloads: router({
    listForSession: publicProcedure.input(z.object({ sessionId: z.string().min(1).max(255) })).query(async ({ input }) => {
      try {
        return await listDownloadAccess(input.sessionId);
      } catch (error) {
        throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Downloads unavailable" });
      }
    }),
  }),
  // Secure admin zone. Every procedure below requires `adminProcedure`
  // (server-side role check). The frontend never grants admin rights.
  // Order status transitions to `paid` are intentionally absent here: only
  // the Stripe webhook may mark an order as paid.
  admin: router({
    dashboard: adminProcedure.query(async () => {
      try {
        return await getAdminDashboard();
      } catch (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: safeAdminMessage(error, "Dashboard unavailable") });
      }
    }),
    products: router({
      list: adminProcedure
        .input(z.object({
          search: z.string().max(180).optional(),
          status: z.enum(["draft", "published", "archived"]).optional(),
        }).default({}))
        .query(async ({ input }) => {
          try {
            return await listAdminProducts(input);
          } catch (error) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: safeAdminMessage(error, "Products unavailable") });
          }
        }),
      getById: adminProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .query(async ({ input }) => {
          try {
            return await getAdminProductById(input.id);
          } catch (error) {
            throw new TRPCError({ code: "NOT_FOUND", message: safeAdminMessage(error, "Product not found") });
          }
        }),
      create: adminProcedure.input(productCreateSchema).mutation(async ({ input }) => {
        try {
          return await createAdminProduct(input);
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: safeAdminMessage(error, "Unable to create product") });
        }
      }),
      update: adminProcedure.input(productUpdateSchema).mutation(async ({ input }) => {
        try {
          return await updateAdminProduct(input);
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: safeAdminMessage(error, "Unable to update product") });
        }
      }),
      publish: adminProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input }) => {
          try {
            return await setAdminProductStatus(input.id, "published");
          } catch (error) {
            throw new TRPCError({ code: "BAD_REQUEST", message: safeAdminMessage(error, "Unable to publish product") });
          }
        }),
      archive: adminProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input }) => {
          try {
            return await setAdminProductStatus(input.id, "archived");
          } catch (error) {
            throw new TRPCError({ code: "BAD_REQUEST", message: safeAdminMessage(error, "Unable to archive product") });
          }
        }),
    }),
    categories: router({
      list: adminProcedure.query(async () => {
        try {
          return await listAdminCategories();
        } catch (error) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: safeAdminMessage(error, "Categories unavailable") });
        }
      }),
      create: adminProcedure.input(categoryCreateSchema).mutation(async ({ input }) => {
        try {
          return await createAdminCategory(input);
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: safeAdminMessage(error, "Unable to create category") });
        }
      }),
      update: adminProcedure.input(categoryUpdateSchema).mutation(async ({ input }) => {
        try {
          return await updateAdminCategory(input);
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: safeAdminMessage(error, "Unable to update category") });
        }
      }),
      delete: adminProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input }) => {
          try {
            return await deleteAdminCategory(input.id);
          } catch (error) {
            throw new TRPCError({ code: "BAD_REQUEST", message: safeAdminMessage(error, "Unable to delete category") });
          }
        }),
    }),
    orders: router({
      list: adminProcedure
        .input(z.object({ limit: z.number().int().min(1).max(200).optional(), offset: z.number().int().min(0).optional() }).default({}))
        .query(async ({ input }) => {
          try {
            return await listAdminOrders(input);
          } catch (error) {
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: safeAdminMessage(error, "Orders unavailable") });
          }
        }),
      getById: adminProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .query(async ({ input }) => {
          try {
            return await getAdminOrderById(input.id);
          } catch (error) {
            throw new TRPCError({ code: "NOT_FOUND", message: safeAdminMessage(error, "Order not found") });
          }
        }),
    }),
    assets: router({
      list: adminProcedure
        .input(z.object({ productId: z.number().int().positive() }))
        .query(async ({ input }) => {
          try {
            return await listAdminAssets(input.productId);
          } catch (error) {
            throw new TRPCError({ code: "NOT_FOUND", message: safeAdminMessage(error, "Assets unavailable") });
          }
        }),
      create: adminProcedure.input(assetCreateSchema).mutation(async ({ input }) => {
        try {
          return await createAdminAsset(input);
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: safeAdminMessage(error, "Unable to create asset") });
        }
      }),
      update: adminProcedure.input(assetUpdateSchema).mutation(async ({ input }) => {
        try {
          return await updateAdminAsset(input);
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: safeAdminMessage(error, "Unable to update asset") });
        }
      }),
      delete: adminProcedure
        .input(z.object({ id: z.number().int().positive() }))
        .mutation(async ({ input }) => {
          try {
            return await deleteAdminAsset(input.id);
          } catch (error) {
            throw new TRPCError({ code: "BAD_REQUEST", message: safeAdminMessage(error, "Unable to delete asset") });
          }
        }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
