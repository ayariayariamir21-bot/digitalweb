import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { categories, products } from "./schema";
import { categories as catalogCategories, products as catalogProducts } from "../client/src/lib/products";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required to run the seed");

const db = drizzle(databaseUrl);

const categoryDescriptions: Record<string, string> = {
  Books: "Ideas you can keep.",
  Software: "Tools that stay out of the way.",
  Websites: "A better first impression.",
  Apps: "Small rituals, made useful.",
  Children: "Gentle stories for families.",
};

for (const category of catalogCategories) {
  await db
    .insert(categories)
    .values({
      name: category.name,
      slug: category.name.toLowerCase(),
      description: categoryDescriptions[category.name],
    })
    .onDuplicateKeyUpdate({
      set: { name: category.name, description: categoryDescriptions[category.name] },
    });
}

for (const product of catalogProducts) {
  const category = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.name, product.category))
    .limit(1);

  if (!category[0]) throw new Error(`Missing category for product ${product.slug}`);

  await db
    .insert(products)
    .values({
      slug: product.slug,
      name: product.name,
      description: product.description,
      shortDescription: product.description,
      eyebrow: product.eyebrow,
      longDescription: product.longDescription,
      features: product.features,
      tags: product.tags,
      price: product.price.replace("$", ""),
      currency: "USD",
      categoryId: category[0].id,
      status: "published",
      featured: product.featured ? 1 : 0,
      downloadType: "external",
      accent: product.accent,
      accentSoft: product.accentSoft,
      icon: product.icon,
      mockup: product.mockup,
      checkoutUrl: product.checkoutUrl,
      priceNote: product.priceNote,
      ageRange: product.ageRange,
      format: product.format ?? "standard",
    })
    .onDuplicateKeyUpdate({
      set: {
        name: product.name,
        description: product.description,
        shortDescription: product.description,
        eyebrow: product.eyebrow,
        longDescription: product.longDescription,
        features: product.features,
        tags: product.tags,
        price: product.price.replace("$", ""),
        categoryId: category[0].id,
        status: "published",
        featured: product.featured ? 1 : 0,
        accent: product.accent,
        accentSoft: product.accentSoft,
        icon: product.icon,
        mockup: product.mockup,
        checkoutUrl: product.checkoutUrl,
        priceNote: product.priceNote,
        ageRange: product.ageRange,
        format: product.format ?? "standard",
      },
    });
}

console.log(`Seeded ${catalogCategories.length} categories and ${catalogProducts.length} products.`);
