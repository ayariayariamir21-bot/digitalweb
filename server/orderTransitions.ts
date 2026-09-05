/**
 * Order / payment state machine (ETAPE 10 §10).
 *
 * Single source of truth for the DOCUMENTED transition matrix. The actual
 * enforcement lives in SQL guards:
 * - `attachPaymentReference`: only when status=pending AND paymentStatus=pending
 * - `markOrderPaid` (webhook only): only when status=pending AND
 *   paymentStatus=pending → sets paid/paid (idempotent: redeliveries and
 *   late events on cancelled/refunded orders change nothing)
 * - `createStripeCheckoutSession`: refuses non-pending orders and orders
 *   that already carry a paymentReference
 *
 * The frontend can never drive these transitions: no tRPC procedure (public
 * or admin) marks an order paid — only the verified Stripe webhook does.
 */

export type OrderStatus = "pending" | "paid" | "failed" | "cancelled" | "refunded";

export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["paid", "failed", "cancelled"],
  paid: ["refunded"],
  failed: [],
  cancelled: [],
  refunded: [],
};

export function isTransitionAllowed(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}
