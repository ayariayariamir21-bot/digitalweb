import { afterEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";

const WEBHOOK_SECRET = "whsec_transitions_test";

const { getOrderForWebhook, markOrderPaid } = vi.hoisted(() => ({
  getOrderForWebhook: vi.fn(),
  markOrderPaid: vi.fn(async () => undefined),
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
vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy_transitions");

const { handleStripeWebhook } = await import("./payments");

function pendingOrder() {
  return {
    order: { id: 999, customerId: 1, status: "pending", paymentStatus: "pending", currency: "USD", paymentReference: null, accessToken: "a".repeat(64) },
    items: [{ id: 1, orderId: 999, productId: 1, productNameSnapshot: "Guide", unitPrice: "10.00", quantity: 1, total: "10.00", createdAt: new Date() }],
    customer: { id: 1, email: "buyer@example.com", name: null, userId: null, createdAt: new Date(), updatedAt: new Date() },
  };
}

function sign(payload: string): string {
  const stripe = new Stripe("sk_test_dummy_transitions");
  return stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
}

function paidPayload(
  overrides: Record<string, unknown> = {},
  sessionOverrides: Record<string, unknown> = {},
) {
  return JSON.stringify({
    id: "evt_trans_1",
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_trans",
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
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("stripe webhook -> order transitions (db mocked)", () => {
  it("marks the order paid after signature + existence + amount + currency pass", async () => {
    getOrderForWebhook.mockResolvedValue(pendingOrder());
    const payload = paidPayload();
    const result = await handleStripeWebhook(Buffer.from(payload), sign(payload));
    expect(result).toEqual({ handled: true, eventId: "evt_trans_1" });
    expect(markOrderPaid).toHaveBeenCalledTimes(1);
    expect(markOrderPaid).toHaveBeenCalledWith(999, "cs_test_trans");
  });

  it("also handles a paid checkout.session.async_payment_succeeded event", async () => {
    getOrderForWebhook.mockResolvedValue(pendingOrder());
    const payload = paidPayload({ id: "evt_async_2", type: "checkout.session.async_payment_succeeded" });
    const result = await handleStripeWebhook(Buffer.from(payload), sign(payload));
    expect(result.handled).toBe(true);
    expect(markOrderPaid).toHaveBeenCalledTimes(1);
  });

  it("rejects when the order does not exist, without any state change", async () => {
    getOrderForWebhook.mockResolvedValue(undefined);
    const payload = paidPayload();
    await expect(handleStripeWebhook(Buffer.from(payload), sign(payload))).rejects.toThrow("Order not found");
    expect(markOrderPaid).not.toHaveBeenCalled();
  });

  it("rejects a paid event whose amount does not match the order total", async () => {
    getOrderForWebhook.mockResolvedValue(pendingOrder());
    const payload = paidPayload({}, { amount_total: 500 });
    await expect(handleStripeWebhook(Buffer.from(payload), sign(payload))).rejects.toThrow("amount does not match");
    expect(markOrderPaid).not.toHaveBeenCalled();
  });

  it("rejects a paid event whose currency does not match the order", async () => {
    getOrderForWebhook.mockResolvedValue(pendingOrder());
    const payload = paidPayload({}, { currency: "eur" });
    await expect(handleStripeWebhook(Buffer.from(payload), sign(payload))).rejects.toThrow("currency does not match");
    expect(markOrderPaid).not.toHaveBeenCalled();
  });

  it("does not duplicate work when the same event is redelivered", async () => {
    let order = pendingOrder();
    getOrderForWebhook.mockImplementation(async () => order);
    markOrderPaid.mockImplementation(async (_id: number, ref: string) => {
      order = { ...order, order: { ...order.order, status: "paid", paymentStatus: "paid", paymentReference: ref } };
    });
    const payload = paidPayload();
    const signature = sign(payload);
    const first = await handleStripeWebhook(Buffer.from(payload), signature);
    const second = await handleStripeWebhook(Buffer.from(payload), signature);
    expect(first.handled).toBe(true);
    expect(second).toEqual({ handled: true, eventId: "evt_trans_1", alreadyPaid: true });
    expect(markOrderPaid).toHaveBeenCalledTimes(1);
  });

  it("refuses to flip an order already paid by another payment", async () => {
    getOrderForWebhook.mockResolvedValue({
      ...pendingOrder(),
      order: { ...pendingOrder().order, status: "paid", paymentStatus: "paid", paymentReference: "cs_other" },
    });
    const payload = paidPayload();
    await expect(handleStripeWebhook(Buffer.from(payload), sign(payload))).rejects.toThrow("already paid");
    expect(markOrderPaid).not.toHaveBeenCalled();
  });

  it("never touches the database for an unpaid session", async () => {
    getOrderForWebhook.mockResolvedValue(pendingOrder());
    const payload = paidPayload({}, { payment_status: "unpaid" });
    const result = await handleStripeWebhook(Buffer.from(payload), sign(payload));
    expect(result).toEqual({ handled: false, eventId: "evt_trans_1" });
    expect(getOrderForWebhook).not.toHaveBeenCalled();
    expect(markOrderPaid).not.toHaveBeenCalled();
  });

  it("never touches the database for an unknown event type", async () => {
    getOrderForWebhook.mockResolvedValue(pendingOrder());
    const payload = paidPayload({ id: "evt_customer", type: "customer.created" });
    const result = await handleStripeWebhook(Buffer.from(payload), sign(payload));
    expect(result.handled).toBe(false);
    expect(getOrderForWebhook).not.toHaveBeenCalled();
    expect(markOrderPaid).not.toHaveBeenCalled();
  });
});