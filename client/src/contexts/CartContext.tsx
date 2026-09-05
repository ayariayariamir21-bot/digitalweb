import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CatalogProduct } from "@/lib/catalog";
import { addCartItem, CART_STORAGE_KEY, cartSubtotal, readCart, updateCartQuantity, type CartItem } from "@/lib/cart";

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  add: (product: CatalogProduct, quantity?: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(readCart);
  useEffect(() => window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items)), [items]);
  const value = useMemo(() => ({
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: cartSubtotal(items),
    add: (product: CatalogProduct, quantity = 1) => setItems(current => addCartItem(current, product, quantity)),
    updateQuantity: (productId: number, quantity: number) => setItems(current => updateCartQuantity(current, productId, quantity)),
    remove: (productId: number) => setItems(current => updateCartQuantity(current, productId, 0)),
    clear: () => setItems([]),
  }), [items]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside CartProvider");
  return value;
}
