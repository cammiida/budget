CREATE TABLE IF NOT EXISTS `account` (
	`account_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`bank_id` text NOT NULL,
	`name` text NOT NULL,
	`owner_name` text,
	`balance` blob NOT NULL,
	PRIMARY KEY(`account_id`, `bank_id`, `user_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`,`bank_id`) REFERENCES `bank`(`user_id`,`bank_id`) ON UPDATE no action ON DELETE no action
);
