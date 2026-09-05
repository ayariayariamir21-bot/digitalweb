import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

const navItems = [
  { label: "Dashboard", href: "/admin" },
  { label: "Products", href: "/admin/products" },
  { label: "Categories", href: "/admin/categories" },
  { label: "Orders", href: "/admin/orders" },
];

function isActive(location: string, href: string) {
  if (href === "/admin") return location === "/admin";
  return location === href || location.startsWith(`${href}/`);
}

export function AdminGate({ children }: { children: React.ReactNode }) {
  const me = trpc.auth.me.useQuery();

  if (me.isPending) {
    return (
      <div className="container section-pad">
        <p className="eyebrow"><span className="eyebrow-line" />Admin</p>
        <p>Checking access…</p>
      </div>
    );
  }

  // Frontend hint only: real enforcement happens server-side via adminProcedure.
  if (me.isError || !me.data || me.data.role !== "admin") {
    return (
      <div className="container section-pad empty-state">
        <p className="eyebrow"><span className="eyebrow-line" />Admin</p>
        <h1>Access <em>denied.</em></h1>
        <p>You need an administrator account to view this area.</p>
        <Link href="/" className="button button-primary">Back to the store</Link>
      </div>
    );
  }

  return <>{children}</>;
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  return (
    <div className="container section-pad">
      <p className="eyebrow"><span className="eyebrow-line" />Admin</p>
      <nav className="flex flex-wrap gap-2 mb-8" aria-label="Admin navigation">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`button ${isActive(location, item.href) ? "button-primary" : "button-secondary"}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
