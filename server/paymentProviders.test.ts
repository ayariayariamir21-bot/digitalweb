import { describe, expect, it } from "vitest";
import { assertProviderImplemented, getConfiguredPaymentProvider } from "./paymentProviders";

describe("payment provider configuration", () => {
  it("defaults to Stripe", () => {
    expect(getConfiguredPaymentProvider(undefined)).toBe("stripe");
  });

  it("accepts the planned Tunisian providers", () => {
    expect(getConfiguredPaymentProvider("konnect")).toBe("konnect");
    expect(getConfiguredPaymentProvider("FLOUCI")).toBe("flouci");
    expect(getConfiguredPaymentProvider("paymee")).toBe("paymee");
  });

  it("rejects unknown providers", () => {
    expect(() => getConfiguredPaymentProvider("unknown")).toThrow("Unsupported PAYMENT_PROVIDER");
  });

  it("keeps unimplemented providers behind an explicit guard", () => {
    expect(() => assertProviderImplemented("konnect")).toThrow("konnect payment integration is not configured yet");
    expect(() => assertProviderImplemented("stripe")).not.toThrow();
  });
});
