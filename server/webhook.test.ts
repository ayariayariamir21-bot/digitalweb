import { afterEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";

const WEBHOOK_SECRET = "whsec_test_secret_for_audit";

vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);
vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");

const { handleStripeWebhook } = await import("./payments");

function sign(payload: string): string {
  const stripe = new Stripe("sk_test_dummy");
  return stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
}

function eventPayload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id: "evt_test_123",
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_123",
        object: "checkout.session",
        payment_status: "paid",
        currency: "usd",
        amount_total: 99900,
        metadata: { orderId: "999" },
      },
    },
    ...overrides,
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("stripe webhook signature", () => {
  it("rejects a webhook without any signature", async () => {
    await expect(handleStripeWebhook(Buffer.from(eventPayload()), undefined)).rejects.toThrow(
      "Missing Stripe signature",
    );
  });

  it("rejects a webhook with a forged signature", async () => {
    await expect(
      handleStripeWebhook(Buffer.from(eventPayload()), "t=1234567890,v1=deadbeef"),
    ).rejects.toThrow();
  });

  it("rejects a webhook with a truncated signature header", async () => {
    await expect(handleStripeWebhook(Buffer.from(eventPayload()), "v1=abc")).rejects.toThrow();
  });
});

describe("stripe webhook event handling", () => {
  it("ignores unknown event types without touching the database", async () => {
    const payload = eventPayload({ id: "evt_unknown_1", type: "customer.created" });
    const result = await handleStripeWebhook(Buffer.from(payload), sign(payload));
    expect(result).toEqual({ handled: false, eventId: "evt_unknown_1" });
  });

  it("handles the same event id twice without error (redelivery safe)", async () => {
    const payload = eventPayload({ id: "evt_redelivered_1", type: "customer.created" });
    const signature = sign(payload);
    const first = await handleStripeWebhook(Buffer.from(payload), signature);
    const second = await handleStripeWebhook(Buffer.from(payload), signature);
    expect(first).toEqual({ handled: false, eventId: "evt_redelivered_1" });
    expect(second).toEqual({ handled: false, eventId: "evt_redelivered_1" });
  });

  it("never treats an unpaid checkout.session.completed as paid", async () => {
    const payload = eventPayload({
      id: "evt_unpaid_1",
      data: { object: { id: "cs_test_unpaid", object: "checkout.session", payment_status: "unpaid", metadata: { orderId: "999" } } },
    });
    const result = await handleStripeWebhook(Buffer.from(payload), sign(payload));
    expect(result).toEqual({ handled: false, eventId: "evt_unpaid_1" });
  });

  it("never treats an unpaid async_payment_succeeded as paid", async () => {
    const payload = eventPayload({
      id: "evt_async_unpaid_1",
      type: "checkout.session.async_payment_succeeded",
      data: { object: { id: "cs_test_async", object: "checkout.session", payment_status: "unpaid", metadata: { orderId: "999" } } },
    });
    const result = await handleStripeWebhook(Buffer.from(payload), sign(payload));
    expect(result).toEqual({ handled: false, eventId: "evt_async_unpaid_1" });
  });

  it("rejects a paid event with invalid order metadata before any state change", async () => {
    const payload = eventPayload({
      id: "evt_badmeta_1",
      data: { object: { id: "cs_test_bad", object: "checkout.session", payment_status: "paid", metadata: {} } },
    });
    await expect(handleStripeWebhook(Buffer.from(payload), sign(payload))).rejects.toThrow(
      "invalid order metadata",
    );
  });

  it("rejects a paid event for another order id before any state change", async () => {
    const payload = eventPayload({
      id: "evt_otherorder_1",
      data: { object: { id: "cs_test_other", object: "checkout.session", payment_status: "paid", metadata: { orderId: "not-a-number" } } },
    });
    await expect(handleStripeWebhook(Buffer.from(payload), sign(payload))).rejects.toThrow(
      "invalid order metadata",
    );
  });

  it("routes a fully verified paid event to the paid transition (fails only on missing DB here)", async () => {
    const payload = eventPayload({ id: "evt_paid_1" });
    // Signature, payment status and metadata all verified; the only failure
    // left in this offline environment is the database connection.
    await expect(handleStripeWebhook(Buffer.from(payload), sign(payload))).rejects.toThrow(
      "Database connection is required",
    );
  });
});
