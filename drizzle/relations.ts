import { relations } from "drizzle-orm";
import {
  categories,
  customers,
  digitalAssets,
  downloads,
  orderItems,
  orders,
  products,
  users,
} from "./schema";

export const categoryRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  orderItems: many(orderItems),
  digitalAssets: many(digitalAssets),
}));

export const userRelations = relations(users, ({ many }) => ({
  customers: many(customers),
}));

export const customerRelations = relations(customers, ({ one, many }) => ({
  user: one(users, {
    fields: [customers.userId],
    references: [users.id],
  }),
  orders: many(orders),
  downloads: many(downloads),
}));

export const orderRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  items: many(orderItems),
  downloads: many(downloads),
}));

export const orderItemRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const digitalAssetRelations = relations(digitalAssets, ({ one, many }) => ({
  product: one(products, {
    fields: [digitalAssets.productId],
    references: [products.id],
  }),
  downloads: many(downloads),
}));

export const downloadRelations = relations(downloads, ({ one }) => ({
  order: one(orders, {
    fields: [downloads.orderId],
    references: [orders.id],
  }),
  customer: one(customers, {
    fields: [downloads.customerId],
    references: [customers.id],
  }),
  asset: one(digitalAssets, {
    fields: [downloads.assetId],
    references: [digitalAssets.id],
  }),
}));
