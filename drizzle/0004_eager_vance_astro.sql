CREATE TABLE IF NOT EXISTS `transaction` (
	`transaction_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`bank_id` text NOT NULL,
	`account_id` text NOT NULL,
	`category_id` text,
	`status` text NOT NULL,
	`booking_date_time` timestamp,
	`value_date_time` timestamp,
	`amount` text NOT NULL,
	`currency` text NOT NULL,
	`creditor_name` text,
	`debtor_name` text,
	PRIMARY KEY(`account_id`, `transaction_id`, `user_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`,`bank_id`,`account_id`) REFERENCES `account`(`user_id`,`bank_id`,`account_id`) ON UPDATE no action ON DELETE cascade
);
