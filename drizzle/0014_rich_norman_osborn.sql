CREATE TABLE IF NOT EXISTS `Accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text,
	`user_id` text NOT NULL,
	`bank_id` text NOT NULL,
	`bban` text,
	`name` text NOT NULL,
	`owner_name` text,
	`interim_available_balance` text,
	`expected_balance` text,
	FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bank_id`) REFERENCES `Banks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `unique_name` ON `Accounts` (`user_id`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `unique_external_id` ON `Accounts` (`user_id`,`account_id`);