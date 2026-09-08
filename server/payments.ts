import Stripe from "stripe";
import { ENV, requireEnv } from "./_core/env";
import { attachPaymentReference, getOrderForPayment, getOrderForWebhook, markOrderPaid } from "./db";
import { assertProviderImplemented, getConfiguredPaymentProvider } from "./paymentProviders";

function getStripe() {
  return new Stripe(requireEnv("STRIPE_SECRET_KEY", ENV.stripeSecretKey));
}

function amountInCents(value: string) {
  const amount = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(amount) || amount < 1) {
    throw new Error("Invalid order amount");
  }
  return amount;
}

export async function createStripeCheckoutSession(orderId: number, accessToken?: string) {
  const provider = getConfiguredPaymentProvider(ENV.paymentProvider);
  assertProviderImplemented(provider);

  const orderData = await getOrderForPayment(orderId, accessToken);
  if (!orderData) throw new Error("Order not found");
  if (orderData.order.paymentStatus !== "pending" || orderData.order.status !== "pending") {
    throw new Error("Order is no longer payable");
  }
  if (orderData.order.paymentReference) {
    throw new Error("A payment session already exists for this order");
  }
  if (!orderData.items.length) throw new Error("Order has no items");

  const calculatedTotal = orderData.items.reduce(
    (sum, item) => sum + amountInCents(item.total),
    0
  );
  if (calculatedTotal !== amountInCents(orderData.order.total)) {
    throw new Error("Order total is invalid");
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: orderData.customer.email,
    line_items: orderData.items.map(item => ({
      quantity: item.quantity,
      price_data: {
        currency: orderData.order.currency.toLowerCase(),
        unit_amount: amountInCents(item.unitPrice),
        product_data: { name: item.productNameSnapshot },
      },
    })),
    metadata: { orderId: String(orderId) },
    success_url: `${ENV.appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${ENV.appUrl}/checkout/cancel?order_id=${orderId}`,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  await attachPaymentReference(orderId, session.id);
  return { url: session.url, sessionId: session.id };
}

export async function handleStripeWebhook(rawBody: Buffer, signature: string | undefined) {
  const secret = requireEnv("STRIPE_WEBHOOK_SECRET", ENV.stripeWebhookSecret);
  if (!signature) throw new Error("Missing Stripe signature");
  const stripe = getStripe();
  // constructEvent verifies the HMAC signature with STRIPE_WEBHOOK_SECRET.
  // The raw body that Stripe sent is required: a JSON-parsed object (or any
  // reformatted body) would fail signature verification.
  const event = stripe.webhooks.constructEvent(rawBody, signature, secret);

  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded"
  ) {
    return { handled: false, eventId: event.id };
  }

  const session = event.data.object as Stripe.Checkout.Session;
  // The signed event alone is never trusted blindly: the session must show a
  // confirmed payment, otherwise the order stays pending.
  if (session.payment_status !== "paid") {
    return { handled: false, eventId: event.id };
  }
  const orderId = Number(session.metadata?.orderId);
  if (!Number.isInteger(orderId) || orderId < 1) throw new Error("Stripe event has invalid order metadata");

  const orderData = await getOrderForWebhook(orderId);
  if (!orderData) throw new Error("Order not found for webhook event");
  if (!orderData.items.length) throw new Error("Order has no items");

  // Server-side amount + currency verification: a stored/whole-amount
  // mismatch (currency, tampered totals) rejects the event before any state
  // change, instead of silently trusting the Stripe session payload.
  if ((session.currency ?? "").toLowerCase() !== orderData.order.currency.toLowerCase()) {
    throw new Error("Stripe event currency does not match the order");
  }
  const expectedTotal = orderData.items.reduce(
    (sum, item) => sum + amountInCents(item.total),
    0
  );
  if (session.amount_total !== expectedTotal) {
    throw new Error("Stripe event amount does not match the order");
  }

  // Idempotent: a redelivered or late event after the order is already paid
  // changes nothing, and an already-paid order owned by another session is
  // never flipped (protects against conflicting refs / late events).
  if (orderData.order.status === "paid" && orderData.order.paymentStatus === "paid") {
    if (orderData.order.paymentReference === session.id) {
      return { handled: true, eventId: event.id, alreadyPaid: true };
    }
    throw new Error("Order is already paid by another payment");
  }

  await markOrderPaid(orderId, session.id);
  console.info("[Stripe] Payment confirmed", {
    eventId: event.id,
    eventType: event.type,
    orderId,
    newStatus: "paid",
  });
  return { handled: true, eventId: event.id };
}
