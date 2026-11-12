CREATE TABLE `addresses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`label` varchar(80) NOT NULL,
	`recipientName` varchar(160) NOT NULL,
	`phone` varchar(32) NOT NULL,
	`city` varchar(100) NOT NULL,
	`district` varchar(120) NOT NULL,
	`details` text,
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `addresses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `banners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(160) NOT NULL,
	`body` text,
	`imageUrl` text,
	`actionText` varchar(60),
	`actionUrl` varchar(500),
	`isActive` boolean NOT NULL DEFAULT false,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `banners_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(180) NOT NULL,
	`description` text,
	`imageUrl` text,
	`color` varchar(24) NOT NULL DEFAULT '#397a54',
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `favorites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`productId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `favorites_id` PRIMARY KEY(`id`),
	CONSTRAINT `favorite_user_product_uq` UNIQUE(`userId`,`productId`)
);
--> statement-breakpoint
CREATE TABLE `offers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(160) NOT NULL,
	`description` text,
	`code` varchar(40) NOT NULL,
	`discountType` enum('fixed','percent') NOT NULL,
	`discountValue` int NOT NULL,
	`minimumOrder` int NOT NULL DEFAULT 0,
	`startsAt` timestamp,
	`endsAt` timestamp,
	`isActive` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `offers_id` PRIMARY KEY(`id`),
	CONSTRAINT `offers_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `order_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`status` enum('new','preparing','ready','out_for_delivery','delivered','cancelled') NOT NULL,
	`note` text,
	`changedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productId` int,
	`productName` varchar(180) NOT NULL,
	`productImage` text,
	`unit` varchar(40) NOT NULL,
	`unitPrice` int NOT NULL,
	`quantity` int NOT NULL,
	`lineTotal` int NOT NULL,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderNumber` varchar(40) NOT NULL,
	`idempotencyKey` varchar(80) NOT NULL,
	`userId` int NOT NULL,
	`offerId` int,
	`recipientName` varchar(160) NOT NULL,
	`phone` varchar(32) NOT NULL,
	`city` varchar(100) NOT NULL,
	`district` varchar(120) NOT NULL,
	`addressDetails` text,
	`customerNote` text,
	`paymentMethod` enum('cash_on_delivery') NOT NULL DEFAULT 'cash_on_delivery',
	`status` enum('new','preparing','ready','out_for_delivery','delivered','cancelled') NOT NULL DEFAULT 'new',
	`subtotal` int NOT NULL,
	`deliveryFee` int NOT NULL,
	`discount` int NOT NULL DEFAULT 0,
	`total` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_orderNumber_unique` UNIQUE(`orderNumber`),
	CONSTRAINT `orders_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `product_recommendations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`recommendedProductId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_recommendations_id` PRIMARY KEY(`id`),
	CONSTRAINT `recommendation_pair_uq` UNIQUE(`productId`,`recommendedProductId`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`slug` varchar(220) NOT NULL,
	`description` text,
	`imageUrl` text,
	`categoryId` int,
	`price` int NOT NULL,
	`unit` varchar(40) NOT NULL DEFAULT 'حبة',
	`stock` int,
	`minQuantity` int NOT NULL DEFAULT 1,
	`quantityStep` int NOT NULL DEFAULT 1,
	`isPublished` boolean NOT NULL DEFAULT false,
	`isAvailable` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `store_settings` (
	`key` varchar(100) NOT NULL,
	`value` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `store_settings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `suspended` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `addresses` ADD CONSTRAINT `addresses_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `favorites` ADD CONSTRAINT `favorites_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `favorites` ADD CONSTRAINT `favorites_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_events` ADD CONSTRAINT `order_events_orderId_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_events` ADD CONSTRAINT `order_events_changedByUserId_users_id_fk` FOREIGN KEY (`changedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_orderId_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_offerId_offers_id_fk` FOREIGN KEY (`offerId`) REFERENCES `offers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_recommendations` ADD CONSTRAINT `product_recommendations_productId_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_recommendations` ADD CONSTRAINT `product_recommendations_recommendedProductId_products_id_fk` FOREIGN KEY (`recommendedProductId`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_categoryId_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `addresses_user_idx` ON `addresses` (`userId`);--> statement-breakpoint
CREATE INDEX `banners_active_order_idx` ON `banners` (`isActive`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `categories_active_order_idx` ON `categories` (`isActive`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `favorites_user_idx` ON `favorites` (`userId`);--> statement-breakpoint
CREATE INDEX `offers_active_dates_idx` ON `offers` (`isActive`,`startsAt`,`endsAt`);--> statement-breakpoint
CREATE INDEX `order_events_order_idx` ON `order_events` (`orderId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`orderId`);--> statement-breakpoint
CREATE INDEX `orders_user_date_idx` ON `orders` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `orders_status_date_idx` ON `orders` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `products_category_publish_idx` ON `products` (`categoryId`,`isPublished`);--> statement-breakpoint
CREATE INDEX `products_publish_order_idx` ON `products` (`isPublished`,`sortOrder`);