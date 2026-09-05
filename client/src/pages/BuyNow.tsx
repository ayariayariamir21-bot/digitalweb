import { ArrowUpRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { ProductVisual } from "@/components/SiteLayout";
import { CheckoutButton } from "@/components/CheckoutButton";
import { trpc } from "@/lib/trpc";
import { formatProductPrice, productVisual } from "@/lib/catalog";

export default function BuyNow() {
  const productsQuery = trpc.products.list.useQuery();
  if (productsQuery.isLoading) return <div className="empty-state"><p>Loading products...</p></div>;
  if (productsQuery.isError) return <div className="empty-state"><p>Products are temporarily unavailable. Please try again.</p></div>;
  const products = productsQuery.data ?? [];
  return <div className="buy-page"><section className="buy-hero"><div className="container buy-hero-inner"><div><p className="eyebrow"><span className="eyebrow-line" />Build your cart</p><h1>Choose something<br /><em>useful.</em></h1></div><p className="buy-hero-note">A simple shelf of books, tools, websites, apps, and gentle things for younger readers.</p></div></section><section className="buy-section section-pad"><div className="container"><div className="buy-grid">{products.map(product => { const visual = productVisual(product); return <article className="buy-card" key={product.slug}><Link href={`/products/${product.slug}`} className="buy-card-visual"><ProductVisual {...visual} compact /><span className="pill">{product.category}</span></Link><div className="buy-card-body"><div><h2>{product.name}</h2><p>{product.description}</p></div><div className="buy-card-footer"><strong>{formatProductPrice(product)}</strong><CheckoutButton product={product} className="button button-primary">Add to cart</CheckoutButton></div></div></article>; })}</div><div className="checkout-trust"><div><LockKeyhole size={18} /><span><strong>Simple checkout</strong><small>Review your selection before placing an order.</small></span></div><div><ShieldCheck size={18} /><span><strong>Guest friendly</strong><small>No account is required to order.</small></span></div></div><p className="buy-footnote">Prices and availability are verified again when your order is placed.</p></div></section></div>;
}


