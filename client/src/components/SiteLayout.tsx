import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useCart } from "@/contexts/CartContext";
import { ArrowUpRight, Instagram, Linkedin, Menu, X } from "lucide-react";

const navItems = [
  { label: "Shop", href: "/products" },
  { label: "Buy now", href: "/buy" },
  { label: "Games", href: "/games" },
  { label: "Stories", href: "/children" },
  { label: "About", href: "/about" },
  { label: "Notes", href: "/#notes" },
  { label: "Contact", href: "/contact" },
];

export function ProductVisual({ type, accent, accentSoft, compact = false }: { type: "book" | "dashboard" | "browser" | "phone"; accent: string; accentSoft: string; compact?: boolean }) {
  if (type === "book") {
    return (
      <div className={`visual visual-book ${compact ? "visual-compact" : ""}`} style={{ ["--accent" as string]: accent, ["--accent-soft" as string]: accentSoft }} aria-hidden="true">
        <div className="book-shadow" />
        <div className="book-cover"><span className="book-kicker">AMIR DIGITAL</span><span className="book-symbol">✦</span><strong>Business<br />&amp; Productivity<br />Prompts</strong><span className="book-caption">A practical field guide for clearer work.</span></div>
      </div>
    );
  }
  if (type === "dashboard") {
    return (
      <div className={`visual visual-dashboard ${compact ? "visual-compact" : ""}`} style={{ ["--accent" as string]: accent, ["--accent-soft" as string]: accentSoft }} aria-hidden="true">
        <div className="dash-window"><div className="dash-top"><i /><i /><i /><span>signal / week 36</span></div><div className="dash-body"><div className="dash-sidebar"><b>Signal<br />Board</b><em /><em /><em /><em /></div><div className="dash-content"><small>THIS WEEK</small><strong>Make the next<br />clear decision.</strong><div className="dash-line" /><div className="dash-cards"><i /><i /><i /></div></div></div></div>
      </div>
    );
  }
  if (type === "browser") {
    return (
      <div className={`visual visual-browser ${compact ? "visual-compact" : ""}`} style={{ ["--accent" as string]: accent, ["--accent-soft" as string]: accentSoft }} aria-hidden="true">
        <div className="browser-window"><div className="browser-bar"><i /><i /><i /><span>fieldnotes.studio</span></div><div className="browser-page"><small>FIELD NOTES STUDIO</small><strong>Make room<br />for good work.</strong><div className="browser-button">Read the notes <ArrowUpRight size={12} /></div><div className="browser-block" /></div></div>
      </div>
    );
  }
  return (
    <div className={`visual visual-phone ${compact ? "visual-compact" : ""}`} style={{ ["--accent" as string]: accent, ["--accent-soft" as string]: accentSoft }} aria-hidden="true">
      <div className="phone-shell"><div className="phone-speaker" /><div className="phone-screen"><small>MONDAY, SEP 04</small><strong>A little<br />counts.</strong><div className="habit-row"><span>Read 10 pages</span><b>✓</b></div><div className="habit-row"><span>Walk outside</span><b>✓</b></div><div className="habit-row muted"><span>Write one line</span><b>+</b></div></div></div>
    </div>
  );
}

export function SiteLayout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [location] = useLocation();
  const { itemCount } = useCart();

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="site-shell">
      <div className="announcement"><span>New: Business &amp; Productivity Prompts is live</span><Link href="/products/business-productivity-prompts">Explore the guide <ArrowUpRight size={14} /></Link></div>
      <header className="site-header">
        <div className="container nav-wrap">
          <Link href="/" className="brand" onClick={closeMenu} aria-label="Amir Digital home"><span className="brand-mark">A</span><span>amir<span className="brand-dot">.</span>digital</span></Link>
          <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
          <nav className={`main-nav ${menuOpen ? "is-open" : ""}`} aria-label="Main navigation">
            {navItems.map((item) => <Link key={item.href} href={item.href} onClick={closeMenu} className={location === item.href ? "active" : ""}>{item.label}</Link>)}
            <Link href="/cart" className="nav-cta" onClick={closeMenu}>Cart ({itemCount}) <ArrowUpRight size={15} /></Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="site-footer">
        <div className="container footer-grid">
          <div><Link href="/" className="brand footer-brand"><span className="brand-mark">A</span><span>amir<span className="brand-dot">.</span>digital</span></Link><p className="footer-copy">Small digital products for clearer work and a little more room to think.</p><div className="socials"><a href="https://linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn"><Linkedin size={17} /></a><a href="https://twitter.com" target="_blank" rel="noreferrer" aria-label="Twitter"><span className="x-icon">𝕏</span></a><a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={17} /></a></div></div>
          <div className="footer-links"><div><span className="footer-label">Explore</span><Link href="/products">All products</Link><Link href="/buy">Buy now</Link><Link href="/games">Games</Link><Link href="/children">Children’s room</Link><Link href="/about">About Amir</Link><Link href="/#notes">Notes</Link></div><div><span className="footer-label">Say hello</span><a href="mailto:hello@amir.digital">hello@amir.digital</a><Link href="/signup">Join the newsletter</Link><Link href="/contact">Contact form</Link><span className="footer-small">Usually replies within 2 days.</span></div></div>
        </div>
        <div className="container footer-bottom"><span>© 2026 Amir Digital. Built with intention.</span><span>Secure checkout via Gumroad / Stripe</span></div>
      </footer>
    </div>
  );
}
