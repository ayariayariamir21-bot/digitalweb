import { ArrowRight, Minus, Plus, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { useCart } from "@/contexts/CartContext";
import { formatProductPrice } from "@/lib/catalog";

export default function Cart() {
  const { items, subtotal, updateQuantity, remove, clear } = useCart();
  const currency = items[0]?.currency ?? "USD";
  return <div className="container section-pad">
    <p className="eyebrow"><span className="eyebrow-line" />Your selection</p>
    <h1>Shopping <em>cart.</em></h1>
    {items.length === 0 ? <div className="empty-state"><p>Your cart is empty.</p><Link href="/products" className="button button-primary">Browse products <ArrowRight size={15} /></Link></div> :
      <div className="cart-layout"><section>{items.map(item => <article className="cart-item" key={item.productId}><div className="cart-item-info">{item.image ? <img src={item.image} alt="" className="cart-item-image" /> : null}<div><h2>{item.name}</h2><p>{formatProductPrice({ price: item.price, currency: item.currency })} each</p></div></div><div className="cart-item-controls"><button type="button" onClick={() => updateQuantity(item.productId, item.quantity - 1)} aria-label={`Decrease ${item.name}`}><Minus size={14} /></button><span>{item.quantity}</span><button type="button" onClick={() => updateQuantity(item.productId, item.quantity + 1)} aria-label={`Increase ${item.name}`}><Plus size={14} /></button><strong>{new Intl.NumberFormat("en-US", { style: "currency", currency: item.currency }).format(Number(item.price) * item.quantity)}</strong><button type="button" onClick={() => remove(item.productId)} aria-label={`Remove ${item.name}`}><Trash2 size={16} /></button></div></article>)}</section><aside className="cart-summary"><h2>Summary</h2><p><span>Items</span><strong>{items.reduce((sum, item) => sum + item.quantity, 0)}</strong></p><p><span>Subtotal</span><strong>{new Intl.NumberFormat("en-US", { style: "currency", currency }).format(subtotal)}</strong></p><Link href="/checkout" className="button button-primary">Checkout <ArrowRight size={15} /></Link><button type="button" className="text-link" onClick={clear}>Clear cart</button></aside></div>}
  </div>;
}
