import { ArrowUpRight, Gamepad2, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { CheckoutButton } from "@/components/CheckoutButton";
import { ColorSortGame } from "@/components/ColorSortGame";
import { ProductVisual } from "@/components/SiteLayout";
import { trpc } from "@/lib/trpc";
import { formatProductPrice, productVisual } from "@/lib/catalog";

export default function Games() {
  const productsQuery = trpc.products.list.useQuery();
  const gameProducts = (productsQuery.data ?? []).filter(product => product.format === "game");
  if (productsQuery.isLoading) return <div className="empty-state"><p>Loading products...</p></div>;
  if (productsQuery.isError) return <div className="empty-state"><p>Products are temporarily unavailable. Please try again.</p></div>;
  return <div className="games-page"><section className="games-hero"><div className="container games-hero-inner"><div><p className="eyebrow children-eyebrow"><span className="eyebrow-line" />Playable applications</p><h1>Play, make,<br /><em>discover.</em></h1><p>Small browser games and creative applications built for curious children — with clear guidance for grown-ups.</p></div><div className="games-badge"><Gamepad2 size={25} /><span>NO ADS<br />JUST PLAY</span></div></div></section><section className="games-section section-pad"><div className="container"><div className="games-explainer"><div><p className="eyebrow"><span className="eyebrow-line" />The games shelf</p><h2>Apps that invite<br /><em>curiosity.</em></h2></div><div><p>Games live here as their own digital products. Some are playable directly in the page; others can be added to a home screen or delivered as a browser access link.</p><div className="games-promises"><span><ShieldCheck size={17} />No ads</span><span><Sparkles size={17} />Gentle challenges</span></div></div></div><div className="embedded-game-block"><div className="embedded-game-heading"><div><span className="pill">Play now</span><h3>Color Sort</h3><p>Match each shape to its color.</p></div><Link href="/children" className="text-link">Children’s stories <ArrowUpRight size={15} /></Link></div><ColorSortGame /></div><div className="game-product-grid">{gameProducts.map(product => { const visual = productVisual(product); return <article className="game-product-card" key={product.slug}><div className="game-product-visual"><ProductVisual {...visual} compact /></div><div className="game-product-body"><div className="game-product-meta"><span>{product.ageRange}</span><span>{formatProductPrice(product)}</span></div><h3>{product.name}</h3><p>{product.description}</p><div className="game-product-actions"><Link href={`/products/${product.slug}`} className="text-link">App details <ArrowUpRight size={14} /></Link><CheckoutButton product={product}>Get access</CheckoutButton></div></div></article>; })}</div></div></section><section className="games-note"><div className="container"><p>Parents and grown-ups: use your own judgment about age suitability, device settings, and screen time. These experiences do not include public chat.</p></div></section></div>;
}



