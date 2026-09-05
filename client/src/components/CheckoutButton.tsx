import { useState, type MouseEvent, type ReactNode } from "react";
import { ArrowUpRight, Check } from "lucide-react";
import type { CatalogProduct } from "@/lib/catalog";
import { useCart } from "@/contexts/CartContext";

type CheckoutButtonProps = {
  product: CatalogProduct;
  children: ReactNode;
  className?: string;
};

export function CheckoutButton({ product, children, className = "" }: CheckoutButtonProps) {
  const cart = useCart();
  const [loading, setLoading] = useState(false);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (loading) {
      event.preventDefault();
      return;
    }
    cart.add(product);
    setLoading(true);
    window.setTimeout(() => setLoading(false), 700);
  };

  return <button type="button" className={`checkout-button ${className}`} onClick={handleClick} aria-busy={loading}>{loading ? <><Check size={15} />Added to cart</> : <>{children}<ArrowUpRight size={15} /></>}</button>;
}
