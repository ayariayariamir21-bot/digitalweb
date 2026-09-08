import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import Stripe from "stripe";
import { rateLimit, resetRateLimits } from "./_core/rateLimit";

const WEBHOOK_SECRET = "whsec_http_test";

const { markOrderPaid, getOrderForWebhook } = vi.hoisted(() => ({
  markOrderPaid: vi.fn(async () => undefined),
  getOrderForWebhook: vi.fn(),
}));

vi.mock("./db", () => ({
  getOrderForWebhook,
  markOrderPaid,
  attachPaymentReference: vi.fn(async () => undefined),
  getOrderForPayment: vi.fn(async () => undefined),
}));

// Must be stubbed BEFORE the payments module is loaded: `_core/env.ts`
// snapshots process.env at import time.
vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);
vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy_http");

const { handleStripeWebhook } = await import("./payments");

function pendingOrder() {
  return {
    order: { id: 999, customerId: 1, status: "pending", paymentStatus: "pending", currency: "USD", paymentReference: null, accessToken: "a".repeat(64) },
    items: [{ id: 1, orderId: 999, productId: 1, productNameSnapshot: "Guide", unitPrice: "10.00", quantity: 1, total: "10.00", createdAt: new Date() }],
    customer: { id: 1, email: "buyer@example.com", name: null, userId: null, createdAt: new Date(), updatedAt: new Date() },
  };
}

/**
 * Replicates the EXACT middleware wiring of server/_core/index.ts: the
 * webhook route consumes the raw body (express.raw) and is registered
 * BEFORE the generic express.json() middleware.
 */
function buildApp() {
  const app = express();
  app.post(
    "/api/stripe/webhook",
    rateLimit("http:stripe-webhook", { windowMs: 60_000, max: 300 }),
    express.raw({ type: "application/json", limit: "1mb" }),
    async (req, res) => {
      try {
        const signature = req.headers["stripe-signature"];
        await handleStripeWebhook(req.body as Buffer, typeof signature === "string" ? signature : undefined);
        res.json({ received: true });
      } catch {
        res.status(400).json({ error: "Invalid webhook" });
      }
    }
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));
  return app;
}

function signedPayload(
  overrides: Record<string, unknown> = {},
  sessionOverrides: Record<string, unknown> = {},
) {
  const body = JSON.stringify({
    id: "evt_http_1",
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_http",
        object: "checkout.session",
        payment_status: "paid",
        currency: "usd",
        amount_total: 1000,
        metadata: { orderId: "999" },
        ...sessionOverrides,
      },
    },
    ...overrides,
  });
  const stripe = new Stripe("sk_test_dummy_http");
  const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret: WEBHOOK_SECRET });
  return { body, signature };
}

let server: Server | undefined;
let baseUrl = "";

function startApp(app: ReturnType<typeof buildApp>) {
  return new Promise<string>(resolve => {
    server = createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const addr = server?.address();
      if (addr && typeof addr === "object") resolve(`http://127.0.0.1:${addr.port}`);
      else throw new Error("Unable to bind test server");
    });
  });
}

async function post(payload: string, signature: string | undefined, contentType = "application/json") {
  const headers: Record<string, string> = { "content-type": contentType };
  if (signature) headers["stripe-signature"] = signature;
  const res = await fetch(`${baseUrl}/api/stripe/webhook`, { method: "POST", headers, body: payload });
  return { status: res.status, json: (await res.json()) as { received?: boolean; error?: string } };
}

beforeEach(async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  resetRateLimits();
  markOrderPaid.mockClear();
  getOrderForWebhook.mockReset();
  getOrderForWebhook.mockResolvedValue(pendingOrder());
  baseUrl = await startApp(buildApp());
});

afterEach(async () => {
  (console.error as unknown as { mockRestore?: () => void }).mockRestore?.();
  await new Promise<void>(resolve => {
    if (!server) {
      resolve();
      return;
    }
    server.close(() => resolve());
    server = undefined;
  });
});

describe("POST /api/stripe/webhook (HTTP surface)", () => {
  it("returns HTTP 200 and marks the order paid for a valid signed event", async () => {
    const { body, signature } = signedPayload();
    const res = await post(body, signature);
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ received: true });
    expect(markOrderPaid).toHaveBeenCalledTimes(1);
    expect(markOrderPaid).toHaveBeenCalledWith(999, "cs_test_http");
  });

  it("returns HTTP 400 for a forged signature and changes nothing", async () => {
    const { body } = signedPayload();
    const res = await post(body, "t=1234567890,v1=deadbeef");
    expect(res.status).toBe(400);
    expect(markOrderPaid).not.toHaveBeenCalled();
  });

  it("returns HTTP 400 when the signature header is missing", async () => {
    const { body } = signedPayload();
    const res = await post(body, undefined);
    expect(res.status).toBe(400);
    expect(markOrderPaid).not.toHaveBeenCalled();
  });

  it("rejects a non-raw body (wrong content-type): raw listener skipped -> 400", async () => {
    const { body, signature } = signedPayload();
    const res = await post(body, signature, "text/plain");
    expect(res.status).toBe(400);
    expect(markOrderPaid).not.toHaveBeenCalled();
  });

  it("returns HTTP 200 without touching state for an unpaid session", async () => {
    const { body, signature } = signedPayload({}, { payment_status: "unpaid" });
    const res = await post(body, signature);
    expect(res.status).toBe(200);
    expect(getOrderForWebhook).not.toHaveBeenCalled();
    expect(markOrderPaid).not.toHaveBeenCalled();
  });

  it("returns HTTP 400 and changes nothing when the order does not exist", async () => {
    getOrderForWebhook.mockResolvedValueOnce(undefined);
    const { body, signature } = signedPayload();
    const res = await post(body, signature);
    expect(res.status).toBe(400);
    expect(markOrderPaid).not.toHaveBeenCalled();
  });

  it("returns HTTP 400 when the paid amount does not match the order total", async () => {
    const { body, signature } = signedPayload({}, { amount_total: 500 });
    const res = await post(body, signature);
    expect(res.status).toBe(400);
    expect(markOrderPaid).not.toHaveBeenCalled();
  });

  it("returns HTTP 400 when the paid currency does not match the order", async () => {
    const { body, signature } = signedPayload({}, { currency: "eur" });
    const res = await post(body, signature);
    expect(res.status).toBe(400);
    expect(markOrderPaid).not.toHaveBeenCalled();
  });
});