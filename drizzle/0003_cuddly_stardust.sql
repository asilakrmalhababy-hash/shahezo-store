CREATE TABLE `customer_push_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`endpointHash` varchar(64) NOT NULL,
	`encryptedPayload` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_push_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_push_order_endpoint_uq` UNIQUE(`orderId`,`endpointHash`)
);
--> statement-breakpoint
CREATE TABLE `owner_push_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`endpointHash` varchar(64) NOT NULL,
	`encryptedPayload` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `owner_push_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `owner_push_user_endpoint_uq` UNIQUE(`userId`,`endpointHash`)
);
--> statement-breakpoint
ALTER TABLE `customer_push_subscriptions` ADD CONSTRAINT `customer_push_subscriptions_orderId_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `owner_push_subscriptions` ADD CONSTRAINT `owner_push_subscriptions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `customer_push_order_idx` ON `customer_push_subscriptions` (`orderId`);