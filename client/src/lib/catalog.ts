import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

export type CatalogProduct = inferRouterOutputs<AppRouter>["products"]["list"][number];

export const categoryFallbackDescription: Record<string, string> = {
  Books: "Ideas you can keep.",
  Software: "Tools that stay out of the way.",
  Websites: "A better first impression.",
  Apps: "Small rituals, made useful.",
  Children: "Gentle stories for families.",
};

export function formatProductPrice(product: Pick<CatalogProduct, "price" | "currency">) {
  const amount = Number(product.price);
  if (!Number.isFinite(amount)) return `${product.price} ${product.currency}`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: product.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function productVisual(product: Pick<CatalogProduct, "mockup" | "accent" | "accentSoft">) {
  return {
    type: product.mockup,
    accent: product.accent ?? "#f47843",
    accentSoft: product.accentSoft ?? "#fff0e8",
  } as const;
}
