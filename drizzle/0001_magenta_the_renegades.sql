CREATE TABLE `users_banks_relations` (
	`user_id` integer NOT NULL,
	`bank_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);
