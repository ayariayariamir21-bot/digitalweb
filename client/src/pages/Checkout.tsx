import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useCart } from "@/contexts/CartContext";
import { trpc } from "@/lib/trpc";

export default function Checkout() {
  const { items, subtotal, clear } = useCart();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const createCheckout = trpc.orders.createCheckoutSession.useMutation({
    onSuccess: result => { clear(); window.location.assign(result.url); },
    onError: error => toast.error(error.message),
  });
  const createOrder = trpc.orders.create.useMutation({
    // The accessToken proves this browser created the order; it is required
    // to open the Stripe session and is never persisted anywhere.
    onSuccess: result => createCheckout.mutate({ orderId: result.orderId, accessToken: result.accessToken }),
    onError: error => toast.error(error.message),
  });
  if (items.length === 0) return <div className="container section-pad empty-state"><p>Your cart is empty.</p><Link href="/products" className="button button-primary">Browse products</Link></div>;
  return <div className="container section-pad"><Link href="/cart" className="back-link"><ArrowLeft size={15} /> Back to cart</Link><p className="eyebrow"><span className="eyebrow-line" />Guest checkout</p><h1>Almost <em>there.</em></h1><form className="checkout-form" onSubmit={event => { event.preventDefault(); createOrder.mutate({ email, name: name || undefined, items: items.map(item => ({ productId: item.productId, quantity: item.quantity })) }); }}><label>Email address<input required type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></label><label>Name <span>(optional)</span><input value={name} onChange={event => setName(event.target.value)} placeholder="Your name" /></label><p className="checkout-total">Total <strong>{new Intl.NumberFormat("en-US", { style: "currency", currency: items[0]?.currency ?? "USD" }).format(subtotal)}</strong></p><button className="button button-primary" type="submit" disabled={createOrder.isPending || createCheckout.isPending}>{createOrder.isPending || createCheckout.isPending ? "Preparing secure checkout…" : "Continue to secure checkout"}</button></form></div>;
}
