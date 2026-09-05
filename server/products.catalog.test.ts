import { describe, expect, it } from "vitest";
import { categories, categoryFilters, products } from "../client/src/lib/products";

describe("product catalog", () => {
  it("includes the Children category and dedicated products", () => {
    expect(categoryFilters).toContain("Children");
    expect(categories.find((category) => category.name === "Children")?.count).toBe("01");
    expect(products.filter((product) => product.format === "story")).toHaveLength(1);
    expect(products.filter((product) => product.format === "game")).toHaveLength(1);
  });

  it("keeps every product routable and checkout-ready", () => {
    expect(products.every((product) => product.slug && product.checkoutUrl)).toBe(true);
    expect(new Set(products.map((product) => product.slug)).size).toBe(products.length);
  });
});
