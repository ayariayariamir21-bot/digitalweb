ALTER TABLE `products` ADD `eyebrow` varchar(180);--> statement-breakpoint
ALTER TABLE `products` ADD `longDescription` text;--> statement-breakpoint
ALTER TABLE `products` ADD `features` json NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `tags` json NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `accent` varchar(20);--> statement-breakpoint
ALTER TABLE `products` ADD `accentSoft` varchar(20);--> statement-breakpoint
ALTER TABLE `products` ADD `icon` varchar(10);--> statement-breakpoint
ALTER TABLE `products` ADD `mockup` enum('book','dashboard','browser','phone') DEFAULT 'book' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `checkoutUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `products` ADD `priceNote` varchar(120);--> statement-breakpoint
ALTER TABLE `products` ADD `ageRange` varchar(80);--> statement-breakpoint
ALTER TABLE `products` ADD `format` enum('standard','story','game') DEFAULT 'standard' NOT NULL;