import { Link, useLocation } from "wouter";
import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  derivePaymentResultStatus,
  PAYMENT_RESULT_MAX_WAIT_MS,
  PAYMENT_RESULT_POLL_INTERVAL_MS,
  type PaymentResultStatus,
} from "@shared/paymentStatus";

type MessageFor = {
  title: string;
  em: string;
  body: string;
};

const MESSAGES: Record<PaymentResultStatus, MessageFor> = {
  paid: {
    title: "Payment",
    em: "confirmed.",
    body: "Your order is ready. Download links expire after one hour and allow a limited number of downloads for your protection.",
  },
  pending: {
    title: "Payment",
    em: "received.",
    body: "Your payment is being confirmed securely. This page refreshes automatically for up to 30 seconds.",
  },
  unavailable: {
    title: "Downloads",
    em: "unavailable.",
    body: "The digital asset could not be prepared. Please contact us for help.",
  },
  failed: {
    title: "Payment",
    em: "not confirmed.",
    body: "We could not confirm your payment within 30 seconds. If you completed the payment, contact us and we will check your order.",
  },
};

export default function PaymentResult() {
  const [location] = useLocation();
  const cancelled = location.startsWith("/checkout/cancel");
  const sessionId = (new URLSearchParams(window.location.search).get("session_id") ?? "").trim();
  const noSession = !cancelled && sessionId.length === 0;
  const [timedOut, setTimedOut] = useState(false);
  const startedAt = useRef<number>(Date.now());
  const refetchRef = useRef<(() => void) | null>(null);

  const query = trpc.downloads.listForSession.useQuery(
    { sessionId },
    { enabled: !cancelled && !noSession && !timedOut, retry: false },
  );
  refetchRef.current = query.refetch;

  const status = derivePaymentResultStatus({
    cancelled,
    hasData: Boolean(query.data),
    timedOut: timedOut || noSession,
    errorMessage: query.error?.message ?? null,
  });

  const elapsedSinceStart = () => Date.now() - startedAt.current;

  useEffect(() => {
    if (cancelled || noSession) return;
    // Stop polling the moment the order is paid, or as soon as the error is
    // not a transient "still confirming" state.
    if (status === "paid" || status === "unavailable" || status === "failed") return;

    const timeoutMillis = Math.max(0, PAYMENT_RESULT_MAX_WAIT_MS - elapsedSinceStart());
    const deadline = setTimeout(() => setTimedOut(true), timeoutMillis);
    const timer = setInterval(() => {
      refetchRef.current?.();
    }, PAYMENT_RESULT_POLL_INTERVAL_MS);

    return () => {
      clearInterval(timer);
      clearTimeout(deadline);
    };
  }, [cancelled, noSession, status]);

  if (cancelled) {
    return (
      <div className="container section-pad empty-state">
        <p className="eyebrow"><span className="eyebrow-line" />Stripe checkout</p>
        <h1>Payment <em>cancelled.</em></h1>
        <p>Your order remains pending. You can return to the cart and try again.</p>
        <Link href="/cart" className="button button-primary">Return to cart</Link>
      </div>
    );
  }

  const message = noSession
    ? { title: "Payment", em: "not found.", body: "No payment session was found in this link." }
    : MESSAGES[status];
  const downloads = query.data?.access ?? [];

  return (
    <div className="container section-pad empty-state">
      <p className="eyebrow"><span className="eyebrow-line" />Stripe checkout</p>
      <h1>{message.title} <em>{message.em}</em></h1>
      <p>
        {status === "unavailable"
          ? query.error?.message ?? message.body
          : message.body}
      </p>
      {status === "paid" &&
        downloads.map(file => (
          <p key={file.url}>
            <strong>{file.productName}</strong> - {file.fileName} (v{file.version}){" "}
            <a className="button button-primary" href={file.url}>Download</a>
          </p>
        ))}
      <p>
        <Link href="/products" className="button button-primary">
          {status === "paid" ? "Continue browsing" : "Back to products"}
        </Link>
      </p>
    </div>
  );
}