import { ArrowUpRight, Check, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { ProductVisual } from "@/components/SiteLayout";
import { CheckoutButton } from "@/components/CheckoutButton";
import { trpc } from "@/lib/trpc";
import { formatProductPrice, productVisual } from "@/lib/catalog";

export default function Products() {
  const search = useSearch();
  const productsQuery = trpc.products.list.useQuery();
  const categoriesQuery = trpc.categories.list.useQuery();
  const categories = categoriesQuery.data ?? [];
  const categoryFilters = ["All", ...categories.map(category => category.name)];
  const requestedCategory = new URLSearchParams(search).get("category");
  const [filter, setFilter] = useState(requestedCategory ?? "All");
  const filtered = useMemo(
    () => filter === "All" ? productsQuery.data ?? [] : (productsQuery.data ?? []).filter(product => product.category === filter),
    [filter, productsQuery.data]
  );

  if (productsQuery.isLoading || categoriesQuery.isLoading) {
    return <div className="empty-state"><p>Loading products...</p></div>;
  }
  if (productsQuery.isError || categoriesQuery.isError) {
    return <div className="empty-state"><p>Products are temporarily unavailable. Please try again.</p></div>;
  }

  return <div className="products-page"><section className="page-intro"><div className="container page-intro-inner"><div><p className="eyebrow"><span className="eyebrow-line" />The collection</p><h1>Good tools for<br /><em>the work ahead.</em></h1></div><p className="page-intro-note">A growing shelf of books, software,<br />websites, apps, and children’s products<br />made with care.</p></div></section><section className="catalog-section section-pad"><div className="container"><div className="filter-bar"><div className="filter-label"><SlidersHorizontal size={15} />Filter by format</div><div className="filter-pills">{categoryFilters.map(item => <button className={filter === item ? "selected" : ""} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div><span className="result-count">{filtered.length.toString().padStart(2, "0")} products</span></div>{filtered.length === 0 ? <div className="empty-state"><p>No products available.</p></div> : <div className="catalog-grid">{filtered.map(product => { const visual = productVisual(product); return <article className="catalog-card" key={product.slug}><Link href={`/products/${product.slug}`} className="catalog-visual"><ProductVisual {...visual} compact /><span className="catalog-arrow"><ArrowUpRight size={16} /></span></Link><div className="catalog-card-body"><div className="product-meta"><span className="pill">{product.category}</span><span>{product.tags[0]}</span></div><Link href={`/products/${product.slug}`}><h2>{product.name}</h2></Link><p>{product.description}</p><div className="catalog-footer"><strong>{formatProductPrice(product)}</strong><CheckoutButton product={product}>Buy now</CheckoutButton></div></div></article>; })}</div>}<div className="catalog-note"><Check size={16} /><span>Every purchase includes lifetime access to updates and a simple, human setup guide.</span></div></div></section></div>;
}



