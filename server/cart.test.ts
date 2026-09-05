import { describe, expect, it } from "vitest";
import { addCartItem, cartSubtotal, MAX_CART_QUANTITY, updateCartQuantity, type CartItem } from "../client/src/lib/cart";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const product = { id: 4, slug: "guide", name: "Guide", price: "12.50", currency: "USD", image: null };
describe("cart calculations", () => {
  it("merges quantities by productId and calculates subtotal", () => {
    const once = addCartItem([], product);
    const twice = addCartItem(once, product, 2);
    expect(twice[0].quantity).toBe(3);
    expect(cartSubtotal(twice)).toBe(37.5);
  });
  it("removes an item when quantity reaches zero", () => {
    const items: CartItem[] = [{ ...product, productId: 4, quantity: 1 }];
    expect(updateCartQuantity(items, 4, 0)).toEqual([]);
  });
  it("caps quantities at the supported maximum", () => {
    expect(addCartItem([], product, MAX_CART_QUANTITY + 10)[0].quantity).toBe(MAX_CART_QUANTITY);
    expect(updateCartQuantity(addCartItem([], product), 4, MAX_CART_QUANTITY + 10)[0].quantity).toBe(MAX_CART_QUANTITY);
  });
});

describe("orders.create validation", () => {
  const caller = appRouter.createCaller({
    user: null,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  });

  it("rejects an empty cart before database access", async () => {
    await expect(caller.orders.create({ email: "buyer@example.com", items: [] })).rejects.toThrow();
  });

  it("rejects invalid quantities before database access", async () => {
    await expect(caller.orders.create({
      email: "buyer@example.com",
      items: [{ productId: 4, quantity: 0 }],
    })).rejects.toThrow();
    await expect(caller.orders.create({
      email: "buyer@example.com",
      items: [{ productId: 4, quantity: 100 }],
    })).rejects.toThrow();
  });

  it("rejects invalid guest email before database access", async () => {
    await expect(caller.orders.create({
      email: "not-an-email",
      items: [{ productId: 4, quantity: 1 }],
    })).rejects.toThrow();
  });
});
