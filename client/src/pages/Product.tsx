import { ArrowLeft, ArrowRight, ArrowUpRight, Check, LockKeyhole, Quote } from "lucide-react";
import { Link, useRoute } from "wouter";
import { ProductVisual } from "@/components/SiteLayout";
import { CheckoutButton } from "@/components/CheckoutButton";
import { trpc } from "@/lib/trpc";
import { formatProductPrice, productVisual } from "@/lib/catalog";

export default function Product() {
  const [, params] = useRoute("/products/:slug");
  const slug = params?.slug ?? "";
  const productQuery = trpc.products.getBySlug.useQuery({ slug }, { enabled: Boolean(slug), retry: false });
  const productsQuery = trpc.products.list.useQuery();

  if (productQuery.isLoading) return <div className="empty-state"><p>Loading product...</p></div>;
  if (productQuery.isError || !productQuery.data) return <div className="empty-state"><p>That product could not be found.</p><Link href="/products" className="button button-dark">Back to products</Link></div>;

  const product = productQuery.data;
  const related = (productsQuery.data ?? []).filter(item => item.slug !== product.slug).slice(0, 2);
  const visual = productVisual(product);

  return <div className="product-page"><div className="container"><Link href="/products" className="back-link"><ArrowLeft size={15} /> All products</Link><section className="product-hero"><div className="product-hero-visual"><ProductVisual {...visual} /></div><div className="product-hero-copy"><div className="product-meta"><span className="pill">{product.category}</span><span>{product.eyebrow}</span></div><h1>{product.name}</h1><p className="product-lede">{product.description}</p><div className="product-buy"><div><strong>{formatProductPrice(product)}</strong><span>{product.priceNote}</span></div><CheckoutButton product={product} className="button button-primary">Purchase now</CheckoutButton></div><div className="secure-note"><LockKeyhole size={14} /> Secure checkout · Instant access · One-time payment</div></div></section><section className="product-content-grid"><div className="product-story"><p className="eyebrow"><span className="eyebrow-line" />A closer look</p><h2>Make the next<br /><em>good decision.</em></h2><p>{product.longDescription ?? product.description}</p><p>Designed to be useful on a Tuesday afternoon, not just impressive on launch day. Open it when you need a little momentum, return to it when the context changes, and make it yours.</p></div><div className="feature-panel"><p className="feature-panel-label">What’s included</p><ul>{product.features.map(feature => <li key={feature}><span><Check size={15} /></span>{feature}</li>)}</ul><div className="feature-divider" /><p className="feature-panel-label">Works well for</p><div className="tag-row">{product.tags.map(tag => <span key={tag}>{tag}</span>)}</div></div></section><section className="testimonial-section"><Quote size={27} /><blockquote>“The rare kind of digital product that gives you more clarity than content. I used it the same day and immediately knew what to do next.”</blockquote><div className="quote-author"><span className="quote-avatar">JL</span><span><strong>Jordan Lee</strong><small>Independent consultant</small></span></div></section><section className="related-section"><div className="section-heading"><div><p className="eyebrow"><span className="eyebrow-line" />Keep exploring</p><h2>More from the<br /><em>studio shelf.</em></h2></div><Link href="/products" className="text-link">View all products <ArrowRight size={15} /></Link></div><div className="related-grid">{related.map(item => { const itemVisual = productVisual(item); return <Link href={`/products/${item.slug}`} className="related-card" key={item.slug}><div className="related-visual"><ProductVisual {...itemVisual} compact /></div><div><span className="pill">{item.category}</span><h3>{item.name}</h3><span className="related-link">View product <ArrowUpRight size={14} /></span></div></Link>; })}</div></section></div></div>;
}



