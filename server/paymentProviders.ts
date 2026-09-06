export type PaymentProviderName = "stripe" | "konnect" | "flouci" | "paymee";

export type CheckoutLine = {
  name: string;
  quantity: number;
  unitAmountMinor: number;
  currency: string;
};

export type CheckoutRequest = {
  orderId: number;
  customerEmail: string;
  lines: CheckoutLine[];
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutResponse = {
  url: string;
  providerReference: string;
};

/**
 * Stable domain boundary for payment gateways.
 *
 * The storefront currently uses Stripe, while Konnect, Flouci and Paymee
 * can be added behind this contract after merchant onboarding and webhook
 * specifications are confirmed. Provider-specific payloads must not leak into
 * order or fulfillment code.
 */
export interface PaymentProvider {
  readonly name: PaymentProviderName;
  createCheckout(request: CheckoutRequest): Promise<CheckoutResponse>;
}

export function getConfiguredPaymentProvider(value = process.env.PAYMENT_PROVIDER): PaymentProviderName {
  const provider = (value ?? "stripe").trim().toLowerCase();
  if (provider === "stripe" || provider === "konnect" || provider === "flouci" || provider === "paymee") {
    return provider;
  }
  throw new Error(`Unsupported PAYMENT_PROVIDER: ${provider}`);
}

export function assertProviderImplemented(provider: PaymentProviderName): asserts provider is "stripe" {
  if (provider !== "stripe") {
    throw new Error(`${provider} payment integration is not configured yet`);
  }
}
