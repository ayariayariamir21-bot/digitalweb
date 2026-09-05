export type ProductCategory = "Books" | "Software" | "Websites" | "Apps" | "Children";
export type ProductFormat = "standard" | "story" | "game";

export type Product = {
  slug: string;
  name: string;
  eyebrow: string;
  category: ProductCategory;
  format?: ProductFormat;
  price: string;
  priceNote?: string;
  description: string;
  longDescription: string;
  features: string[];
  tags: string[];
  accent: string;
  accentSoft: string;
  icon: string;
  mockup: "book" | "dashboard" | "browser" | "phone";
  checkoutUrl: string;
  featured?: boolean;
  ageRange?: string;
};

export const products: Product[] = [
  { slug: "business-productivity-prompts", name: "Business & Productivity Prompts", eyebrow: "The prompt library", category: "Books", price: "$19", priceNote: "one-time purchase", description: "A practical collection of prompts for sharper thinking, faster planning, and better work.", longDescription: "Stop staring at a blank page. This field-tested prompt library turns the messy middle of strategy, writing, planning, and execution into a repeatable advantage. Built for founders, operators, and curious professionals who want to make more progress with less friction.", features: ["200+ ready-to-use prompts", "Organized by real work moments", "PDF + Notion workspace", "Lifetime updates"], tags: ["PDF", "Notion", "200+ prompts"], accent: "#f47843", accentSoft: "#fff0e8", icon: "✦", mockup: "book", checkoutUrl: "https://gumroad.com", featured: true },
  { slug: "signal-board", name: "Signal Board", eyebrow: "The decision dashboard", category: "Software", price: "$29", priceNote: "per workspace", description: "A calm command center for turning scattered inputs into your next clear decision.", longDescription: "Signal Board gives small teams a focused space to collect evidence, surface patterns, and move from open question to confident next step. No bloated project management suite — just the signal you need, when you need it.", features: ["Decision log with context", "Weekly signal review", "Shareable read-only views", "CSV export"], tags: ["Web app", "Solo + teams", "No clutter"], accent: "#2f8f83", accentSoft: "#e8f5f1", icon: "◒", mockup: "dashboard", checkoutUrl: "https://gumroad.com" },
  { slug: "field-notes-starter-site", name: "Field Notes Starter Site", eyebrow: "The editorial template", category: "Websites", price: "$89", priceNote: "template license", description: "A warm, conversion-ready home for independent consultants and thoughtful studios.", longDescription: "A flexible website template for people whose best work does not fit inside a stiff corporate box. Field Notes gives your ideas room to breathe with considered typography, modular case studies, and a clear path to enquiry.", features: ["Responsive React template", "Six page layouts", "CMS-ready content blocks", "Setup guide included"], tags: ["React", "Responsive", "CMS-ready"], accent: "#d5a546", accentSoft: "#fbf4df", icon: "↗", mockup: "browser", checkoutUrl: "https://gumroad.com" },
  { slug: "tiny-habits", name: "Tiny Habits", eyebrow: "The gentle tracker", category: "Apps", price: "$12", priceNote: "lifetime access", description: "A frictionless daily app for building momentum without turning your life into a spreadsheet.", longDescription: "Tiny Habits is a deliberately small daily ritual. Choose a few habits, see your streaks without judgment, and keep going. It is designed for the days when your attention is already spoken for.", features: ["Three-tap daily check-in", "Private by default", "Gentle reminders", "Progress snapshots"], tags: ["iOS + web", "Private", "Minimal"], accent: "#5264ad", accentSoft: "#edf0ff", icon: "⌁", mockup: "phone", checkoutUrl: "https://gumroad.com" },
  { slug: "the-cloud-who-kept-a-secret", name: "The Cloud Who Kept a Secret", eyebrow: "A gentle illustrated story", category: "Children", format: "story", price: "$7", priceNote: "digital storybook", description: "A quiet, colorful story about sharing worries and finding a little courage.", longDescription: "A parent-friendly digital storybook for curious children. Follow a small cloud as it learns that keeping a worry alone can make it feel bigger — and that telling a trusted grown-up can make room for light.", features: ["Illustrated digital story", "Read-aloud friendly", "Parent conversation prompts", "Ages 4–7"], tags: ["Storybook", "Ages 4–7", "Read-aloud"], accent: "#f29f58", accentSoft: "#fff4e8", icon: "☁", mockup: "book", checkoutUrl: "https://gumroad.com", ageRange: "Ages 4–7" },
  { slug: "little-makers-playground", name: "Little Makers Playground", eyebrow: "Creative mini-games", category: "Children", format: "game", price: "$9", priceNote: "browser access", description: "A small collection of screen-time-friendly creative games made for curious minds.", longDescription: "Little Makers Playground brings together simple browser games for drawing, sorting, storytelling, and playful pattern-making. There are no ads, no public chat, and no pressure to compete.", features: ["Four creative mini-games", "No ads or public chat", "Play in the browser", "Ages 5–8"], tags: ["HTML5", "Creative play", "Ages 5–8"], accent: "#63a9a0", accentSoft: "#e8f5f1", icon: "✺", mockup: "phone", checkoutUrl: "https://gumroad.com", ageRange: "Ages 5–8" },
];

export const categories = [
  { name: "Books", count: "01", description: "Ideas you can keep." },
  { name: "Software", count: "01", description: "Tools that stay out of the way." },
  { name: "Websites", count: "01", description: "A better first impression." },
  { name: "Apps", count: "01", description: "Small rituals, made useful." },
  { name: "Children", count: "01", description: "Gentle stories for families." },
] as const;

export const posts = [
  { slug: "a-better-way-to-ship-small", category: "Field notes", date: "Sep 02, 2026", title: "A better way to ship small", excerpt: "Why the most useful digital products often begin as one clear promise and a narrow surface area.", readTime: "4 min read" },
  { slug: "the-case-for-calm-tools", category: "Product thinking", date: "Aug 18, 2026", title: "The case for calm tools", excerpt: "Less dashboard, more direction: designing products for attention instead of extraction.", readTime: "6 min read" },
  { slug: "prompts-that-make-space", category: "Working notes", date: "Jul 29, 2026", title: "Prompts that make space", excerpt: "The best prompt is not the cleverest one. It is the one that helps you see what matters next.", readTime: "3 min read" },
];

export const categoryFilters = ["All", "Books", "Software", "Websites", "Apps", "Children"] as const;
export type CategoryFilter = (typeof categoryFilters)[number];
