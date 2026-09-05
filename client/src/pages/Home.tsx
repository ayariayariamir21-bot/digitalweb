import { useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Mail } from "lucide-react";
import { Link } from "wouter";
import { ProductVisual } from "@/components/SiteLayout";
import { CheckoutButton } from "@/components/CheckoutButton";
import { posts } from "@/lib/products";
import { trpc } from "@/lib/trpc";
import { formatProductPrice, productVisual } from "@/lib/catalog";
import { toast } from "sonner";

export default function Home() {
  const [email, setEmail] = useState("");
  const subscribe = trpc.marketing.subscribe.useMutation({ onSuccess: () => { toast.success("You're on the list. Thanks for joining."); setEmail(""); }, onError: () => toast.error("We couldn't save that just now. Please try again.") });
  const featuredQuery = trpc.products.getFeatured.useQuery();
  const productsQuery = trpc.products.list.useQuery();
  const categoriesQuery = trpc.categories.list.useQuery();
  const featured = featuredQuery.data?.[0];
  const categories = (categoriesQuery.data ?? []).map(category => ({
    ...category,
    count: (productsQuery.data ?? []).filter(product => product.category === category.name).length.toString().padStart(2, "0"),
  }));
  const handleSignup = (event: React.FormEvent) => { event.preventDefault(); if (!email || !email.includes("@")) { toast.error("Please enter a valid email address."); return; } subscribe.mutate({ email }); };
  if (featuredQuery.isLoading || productsQuery.isLoading || categoriesQuery.isLoading) return <div className="empty-state"><p>Loading products...</p></div>;
  if (featuredQuery.isError || productsQuery.isError || categoriesQuery.isError || !featured) return <div className="empty-state"><p>Products are temporarily unavailable. Please try again.</p></div>;
  const featuredVisual = productVisual(featured);
  return <>
    <section className="hero-section"><div className="container hero-grid"><div className="hero-copy"><p className="eyebrow"><span className="eyebrow-line" />Independent digital products</p><h1>Useful things<br /><em>for better work.</em></h1><p className="hero-lede">Books, tools, and tiny experiments for people building thoughtful businesses — without the noise.</p><div className="hero-actions"><Link href="/products" className="button button-primary">Browse the collection <ArrowUpRight size={16} /></Link><a href="#featured" className="text-link">See what’s new <ArrowDown size={15} /></a></div><div className="hero-proof"><div className="avatars"><span>AM</span><span>JS</span><span>RK</span><span>+</span></div><p><strong>1,200+ curious people</strong><br />are making space for better work.</p></div></div><div className="hero-art" aria-label="Abstract editorial collage"><div className="art-note">A small<br /><span>studio</span><br />on the internet.</div><div className="art-ring" /><div className="art-card art-card-orange"><span>01</span><strong>MAKE<br />ROOM</strong><small>for the work<br />that matters</small></div><div className="art-card art-card-paper"><span>FIELD NOTE / 036</span><strong>Less<br />noise.<br /><i>More signal.</i></strong><small>amir.digital</small></div><div className="art-scribble">↗</div><div className="art-caption"><span className="caption-dot" />Built for the long game</div></div></div></section>
    <section className="ticker" aria-label="Studio principles"><div className="ticker-track"><span>READ LESS. NOTICE MORE.</span><i>✦</i><span>MAKE THINGS THAT HELP.</span><i>✦</i><span>KEEP IT HUMAN.</span><i>✦</i><span>READ LESS. NOTICE MORE.</span><i>✦</i><span>MAKE THINGS THAT HELP.</span></div></section>
    <section id="featured" className="featured-section section-pad"><div className="container"><div className="section-heading"><div><p className="eyebrow"><span className="eyebrow-line" />The latest release</p><h2>Start with a<br /><em>clearer page.</em></h2></div><Link href={`/products/${featured.slug}`} className="text-link">View product <ArrowRight size={15} /></Link></div><div className="featured-card"><div className="featured-visual"><ProductVisual {...featuredVisual} /></div><div className="featured-details"><div className="product-meta"><span className="pill">{featured.category}</span><span>New release · 2026</span></div><h3>{featured.name}</h3><p>{featured.description}</p><ul className="feature-list">{featured.features.map(feature => <li key={feature}><Check size={15} />{feature}</li>)}</ul><div className="price-row"><div><strong>{formatProductPrice(featured)}</strong><span>{featured.priceNote}</span></div><CheckoutButton product={featured} className="button button-dark">Get the guide</CheckoutButton></div><Link href={`/products/${featured.slug}`} className="subtle-link">See what’s inside <ArrowRight size={14} /></Link></div></div></div></section>
    <section className="category-section section-pad"><div className="container"><div className="section-heading compact-heading"><div><p className="eyebrow"><span className="eyebrow-line" />Browse by format</p><h2>Pick your<br /><em>starting point.</em></h2></div><p className="section-note">A few good places to begin.<br />No endless scrolling required.</p></div><div className="category-grid">{categories.map((category, index) => <Link key={category.name} href={`/products?category=${category.name}`} className={`category-card category-${index + 1}`}><span className="category-count">{category.count}</span><div><h3>{category.name}</h3><p>{category.description}</p></div><ArrowUpRight size={18} /></Link>)}</div></div></section>
    <section id="notes" className="notes-section section-pad"><div className="container"><div className="section-heading"><div><p className="eyebrow"><span className="eyebrow-line" />From the notebook</p><h2>Notes on making<br /><em>useful things.</em></h2></div><Link href="/about" className="text-link">About the studio <ArrowRight size={15} /></Link></div><div className="notes-grid">{posts.map((post, index) => <article className={`note-card note-${index + 1}`} key={post.slug}><div className="note-top"><span>{post.category}</span><span>{post.readTime}</span></div><Link href={`/notes/${post.slug}`}><h3>{post.title}</h3></Link><p>{post.excerpt}</p><Link href={`/notes/${post.slug}`} className="circle-arrow" aria-label={`Read ${post.title}`}><ArrowUpRight size={17} /></Link><div className="note-date">{post.date}</div></article>)}</div></div></section>
    <section className="newsletter-section"><div className="container newsletter-inner"><div><p className="eyebrow light-eyebrow"><span className="eyebrow-line" />A good note, occasionally</p><h2>Make room for<br /><em>what’s next.</em></h2><p className="newsletter-copy">A short email when a new product ships, a useful idea lands, or a thoughtful link is worth sharing.</p></div><form className="signup-form" onSubmit={handleSignup}><label htmlFor="newsletter-email">Your email address</label><div className="input-wrap"><Mail size={17} /><input id="newsletter-email" type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={subscribe.isPending} /><button type="submit" aria-label="Subscribe" disabled={subscribe.isPending}><ArrowUpRight size={18} /></button></div><p>No spam. Unsubscribe whenever you like.</p></form></div></section>
  </>;
}



