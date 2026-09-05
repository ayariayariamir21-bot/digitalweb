ALTER TABLE `downloads` ADD `productId` int NOT NULL;
--> statement-breakpoint
ALTER TABLE `downloads` ADD `tokenHash` varchar(128) NOT NULL;
--> statement-breakpoint
ALTER TABLE `downloads` ADD `maxDownloads` int NOT NULL DEFAULT 10;
--> statement-breakpoint
ALTER TABLE `downloads` ADD CONSTRAINT `downloads_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE `downloads` ADD CONSTRAINT `downloads_token_hash_unique` UNIQUE(`tokenHash`);
--> statement-breakpoint
CREATE INDEX `downloads_product_idx` ON `downloads` (`productId`);
