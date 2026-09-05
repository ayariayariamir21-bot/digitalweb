import type { CatalogProduct } from "./catalog";

export type CartItem = {
  productId: number;
  slug: string;
  name: string;
  price: string;
  currency: string;
  image: string | null;
  quantity: number;
};

export const CART_STORAGE_KEY = "amir-digital-cart";
export const MAX_CART_QUANTITY = 99;

function clampQuantity(quantity: number) {
  return Math.min(MAX_CART_QUANTITY, Math.max(1, Math.floor(quantity)));
}

export function addCartItem(items: CartItem[], product: Pick<CatalogProduct, "id" | "slug" | "name" | "price" | "currency" | "image">, quantity = 1) {
  const existing = items.find(item => item.productId === product.id);
  if (existing) return items.map(item => item.productId === product.id ? { ...item, quantity: clampQuantity(item.quantity + quantity) } : item);
  return [...items, { productId: product.id, slug: product.slug, name: product.name, price: String(product.price), currency: product.currency, image: product.image, quantity: clampQuantity(quantity) }];
}

export function updateCartQuantity(items: CartItem[], productId: number, quantity: number) {
  if (quantity <= 0) return items.filter(item => item.productId !== productId);
  return items.map(item => item.productId === productId ? { ...item, quantity: clampQuantity(quantity) } : item);
}

export function cartSubtotal(items: CartItem[]) {
  return items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
}

export function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed
        .filter(item => Number.isInteger(item?.productId) && typeof item?.slug === "string" && typeof item?.name === "string" && typeof item?.price === "string" && typeof item?.currency === "string" && item.quantity > 0)
        .map(item => ({ ...item, quantity: clampQuantity(item.quantity) }))
      : [];
  } catch {
    return [];
  }
}
