# Amir Digital storefront setup

This project is a responsive React + TypeScript + Tailwind 4 storefront with a full-stack Express/tRPC layer. It includes a home page, filterable product catalog, reusable product detail routes, about and contact pages, responsive navigation, CSS-built product mockups, metadata, reduced-motion support, a database-backed newsletter signup, and a database-backed contact form.

## 1. Add your products

Product content is centralized in `client/src/lib/products.ts`. Add a new object to the `products` array and give it a unique `slug`. The `mockup` field accepts `book`, `dashboard`, `browser`, or `phone`; the visual is rendered in `client/src/components/SiteLayout.tsx` so you can keep product pages lightweight.

```ts
{
  slug: "my-new-tool",
  name: "My New Tool",
  eyebrow: "The focused utility",
  category: "Software",
  price: "$24",
  description: "A one-sentence reason someone should care.",
  longDescription: "The longer product story used on the detail page.",
  features: ["Feature one", "Feature two", "Lifetime updates"],
  tags: ["Web app", "Solo makers"],
  accent: "#2f8f83",
  accentSoft: "#e8f5f1",
  icon: "◒",
  mockup: "dashboard",
  checkoutUrl: "https://gumroad.com/your-product",
}
```

## 2. Connect Gumroad (fastest path)

1. Create a product in Gumroad and configure its price, file delivery, and receipt email.
2. Copy the public product URL.
3. Replace the `checkoutUrl` value for that product in `client/src/lib/products.ts`.
4. Test the purchase button in a private browser window. The button intentionally opens Gumroad in a new tab so payment and digital delivery stay on the hosted checkout provider.

For a product-specific URL, use `https://yourname.gumroad.com/l/your-product-slug` or the public URL Gumroad provides. Keep the `target="_blank"` and `rel="noreferrer"` attributes on purchase links.

## 3. Connect Stripe Checkout (more control)

For Stripe, keep the secret key server-side and create Checkout Sessions from an authenticated server procedure or API route. Never put `STRIPE_SECRET_KEY` in `client/src`, and never create a session directly from the browser with a secret key.

A Next.js-style server route looks like this:

```ts
// app/api/checkout/route.ts
import Stripe from "stripe";
import { NextResponse } from "next/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  const { priceId } = await request.json();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/success`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/products`,
  });
  return NextResponse.json({ url: session.url });
}
```

Then call that server route from a button handler and redirect to the returned `url`. For this current project, the cleanest production route is to add Stripe's Node SDK to the server layer and expose a typed `checkout.createSession` tRPC mutation. Add webhook verification before granting downloads if you move file delivery into your own infrastructure.

## 4. Newsletter and contact forms

The forms call `marketing.subscribe` and `marketing.contact` through the tRPC layer and save to the `subscribers` and `contactMessages` tables. Before production, connect those procedures to an email provider such as MailerLite, ConvertKit, Resend, or Buttondown, and add a notification email for contact inquiries. The database remains a useful source of truth even after adding a mailing-list provider.

After schema changes, run:

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

Use the WebDev SQL migration tool when the hosted environment requires the generated migration to be applied separately.

## 5. Local development and deployment

```bash
pnpm install
pnpm dev
pnpm check
pnpm build
```

The project is already configured for managed HTTPS preview hosting. For an independent deployment, the same React build can be deployed to Vercel or Netlify. If you use this full-stack template, deploy the Express/tRPC server with the frontend rather than a static-only host. Add your custom domain in the hosting dashboard, update the OAuth / checkout success URLs, and verify the domain's HTTPS certificate before announcing the site.

## 6. SEO and scaling checklist

The document title, description, keywords, Open Graph basics, font loading, semantic headings, alt-safe CSS mockups, focus states, and reduced-motion behavior are included. As the catalog grows, move product records into a CMS or database, generate a sitemap, add JSON-LD `Product` and `Article` data, and create a real blog collection with one route per article. For larger products, use image optimization and lazy loading; keep the current CSS mockups for fast-loading editorial placeholder art.

Use the existing `products` array as the first content model. Its stable `slug`, `category`, `price`, `features`, and `checkoutUrl` fields map directly to a CMS or Shopify/Gumroad catalog later.
