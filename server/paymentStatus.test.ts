import { describe, expect, it } from "vitest";
import {
  derivePaymentResultStatus,
  isRetryableConfirmationError,
  PAYMENT_RESULT_MAX_WAIT_MS,
  PAYMENT_RESULT_POLL_INTERVAL_MS,
} from "../shared/paymentStatus";

describe("derivePaymentResultStatus (PaymentResult state machine)", () => {
  it("returns pending while the webhook confirmation is still in flight", () => {
    expect(
      derivePaymentResultStatus({
        cancelled: false,
        hasData: false,
        timedOut: false,
        errorMessage: "Payment is still being confirmed",
      }),
    ).toBe("pending");
    expect(
      derivePaymentResultStatus({
        cancelled: false,
        hasData: false,
        timedOut: false,
        errorMessage: "Payment is not confirmed",
      }),
    ).toBe("pending");
    expect(
      derivePaymentResultStatus({
        cancelled: false,
        hasData: false,
        timedOut: false,
        errorMessage: null,
      }),
    ).toBe("pending");
  });

  it("shows paid as soon as the backend returns download grants", () => {
    expect(
      derivePaymentResultStatus({ cancelled: false, hasData: true, timedOut: false, errorMessage: null }),
    ).toBe("paid");
  });

  it("flags a transient confirmation error as retryable", () => {
    expect(isRetryableConfirmationError("Payment is still being confirmed")).toBe(true);
    expect(isRetryableConfirmationError("Payment is not confirmed")).toBe(true);
    expect(isRetryableConfirmationError("Digital asset is unavailable")).toBe(false);
    expect(isRetryableConfirmationError(null)).toBe(false);
    expect(isRetryableConfirmationError(undefined)).toBe(false);
  });

  it("turns unavailable for a non-transient backend error", () => {
    expect(
      derivePaymentResultStatus({
        cancelled: false,
        hasData: false,
        timedOut: false,
        errorMessage: "Digital asset is unavailable",
      }),
    ).toBe("unavailable");
  });

  it("turns failed after the bounded wait window elapses", () => {
    expect(
      derivePaymentResultStatus({
        cancelled: false,
        hasData: false,
        timedOut: true,
        errorMessage: "Payment is still being confirmed",
      }),
    ).toBe("failed");
  });

  it("stays pending while the poll window has not elapsed, even across retries", () => {
    const loop = Array.from({ length: PAYMENT_RESULT_MAX_WAIT_MS / PAYMENT_RESULT_POLL_INTERVAL_MS });
    for (const _ of loop) {
      expect(
        derivePaymentResultStatus({
          cancelled: false,
          hasData: false,
          timedOut: false,
          errorMessage: "Payment is still being confirmed",
        }),
      ).toBe("pending");
    }
  });
});