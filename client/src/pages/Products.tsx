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
  const categoryFilters = ["Tous", ...categories.map(category => category.name)];
  const requestedCategory = new URLSearchParams(search).get("category");
  const [filter, setFilter] = useState(requestedCategory ?? "Tous");
  const filtered = useMemo(() => filter === "Tous" ? productsQuery.data ?? [] : (productsQuery.data ?? []).filter(product => product.category === filter), [filter, productsQuery.data]);
  if (productsQuery.isLoading || categoriesQuery.isLoading) return <div className="empty-state"><p>Chargement des produits…</p></div>;
  if (productsQuery.isError || categoriesQuery.isError) return <div className="empty-state"><p>La boutique est momentanément indisponible.</p></div>;
  return <div className="products-page"><section className="page-intro"><div className="container page-intro-inner"><div><p className="eyebrow"><span className="eyebrow-line" />La collection Amir Digital</p><h1>Des produits pour<br /><em>aller plus loin.</em></h1></div><p className="page-intro-note">Logiciels, sites web,<br />ressources open source<br />et livres numériques utiles.</p></div></section><section className="catalog-section section-pad"><div className="container"><div className="filter-bar"><div className="filter-label"><SlidersHorizontal size={15} />Filtrer par catégorie</div><div className="filter-pills">{categoryFilters.map(item => <button className={filter === item ? "selected" : ""} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div><span className="result-count">{filtered.length.toString().padStart(2, "0")} produits</span></div>{filtered.length === 0 ? <div className="empty-state"><p>Aucun produit disponible.</p></div> : <div className="catalog-grid">{filtered.map(product => { const visual = productVisual(product); return <article className="catalog-card" key={product.slug}><Link href={`/products/${product.slug}`} className="catalog-visual"><ProductVisual {...visual} compact /><span className="catalog-arrow"><ArrowUpRight size={16} /></span></Link><div className="catalog-card-body"><div className="product-meta"><span className="pill">{product.category}</span><span>{product.tags[0]}</span></div><Link href={`/products/${product.slug}`}><h2>{product.name}</h2></Link><p>{product.description}</p><div className="catalog-footer"><strong>{formatProductPrice(product)}</strong><CheckoutButton product={product}>Acheter</CheckoutButton></div></div></article>; })}</div>}<div className="catalog-note"><Check size={16} /><span>Chaque achat inclut l’accès aux mises à jour et un guide d’installation simple.</span></div></div></section></div>;
}
