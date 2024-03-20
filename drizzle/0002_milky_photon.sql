CREATE TABLE IF NOT EXISTS `Accounts` (
	`account_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`bank_id` text NOT NULL,
	`bban` text,
	`name` text NOT NULL,
	`owner_name` text,
	`balances` text NOT NULL,
	PRIMARY KEY(`account_id`, `bank_id`, `user_id`),
	FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`,`bank_id`) REFERENCES `Banks`(`user_id`,`bank_id`) ON UPDATE no action ON DELETE cascade
);
