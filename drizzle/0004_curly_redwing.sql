CREATE TABLE `users_banks_relations` (
	`requisition_id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`bank_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);

CREATE UNIQUE INDEX `userBankIdx` ON `users_banks_relations` (`user_id`,`bank_id`);