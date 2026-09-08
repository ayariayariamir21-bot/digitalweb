/**
 * Shared client/server logic for the payment result page state machine.
 *
 * The page can only *reflect* the backend state; it never confirms a
 * payment itself. Only the verified Stripe webhook marks an order as paid.
 * These helpers keep the frontend polling logic and its tests in one place.
 */

export type PaymentResultStatus = "pending" | "paid" | "unavailable" | "failed";

export const PAYMENT_RESULT_MAX_WAIT_MS = 30_000;
export const PAYMENT_RESULT_POLL_INTERVAL_MS = 1_500;

/**
 * Errors that mean "Stripe confirmed or will confirm, but the local order is
 * not paid yet" -> the page must keep polling until the webhook lands.
 */
const RETRYABLE_CONFIRMATION = /(Payment is still being confirmed|Payment is not confirmed)/i;

export function isRetryableConfirmationError(message?: string | null): boolean {
  return Boolean(message && RETRYABLE_CONFIRMATION.test(message));
}

/**
 * Pure derivation of the page state. `timedOut` must be true only after the
 * bounded wait window has elapsed (or when no session id was provided).
 */
export function derivePaymentResultStatus(input: {
  cancelled: boolean;
  hasData: boolean;
  timedOut: boolean;
  errorMessage?: string | null;
}): PaymentResultStatus {
  if (input.cancelled) return "pending";
  if (input.hasData) return "paid";
  if (input.timedOut) return "failed";
  if (isRetryableConfirmationError(input.errorMessage)) return "pending";
  if (input.errorMessage) return "unavailable";
  return "pending";
}