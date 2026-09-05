import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

export default function PaymentResult() {
  const [location] = useLocation();
  const cancelled = location.startsWith("/checkout/cancel");
  const sessionId = new URLSearchParams(window.location.search).get("session_id") ?? "";
  const downloads = trpc.downloads.listForSession.useQuery(
    { sessionId },
    { enabled: !cancelled && sessionId.length > 0, retry: false },
  );

  return (
    <div className="container section-pad empty-state">
      <p className="eyebrow"><span className="eyebrow-line" />Stripe checkout</p>
      <h1>{cancelled ? <>Payment <em>cancelled.</em></> : <>Payment <em>received.</em></>}</h1>
      <p>
        {cancelled
          ? "Your order remains pending. You can return to the cart and try again."
          : downloads.isPending
            ? "Your payment is being verified securely."
            : downloads.isError
              ? downloads.error.message
              : "Your order is ready. Download links expire and are limited for your protection."}
      </p>
      {!cancelled && downloads.data?.access.map(file => (
        <p key={file.url}>
          <strong>{file.productName}</strong> - {file.fileName} (v{file.version}){" "}
          <a className="button button-primary" href={file.url}>Download</a>
        </p>
      ))}
      <Link href={cancelled ? "/cart" : "/products"} className="button button-primary">
        {cancelled ? "Return to cart" : "Continue browsing"}
      </Link>
    </div>
  );
}
