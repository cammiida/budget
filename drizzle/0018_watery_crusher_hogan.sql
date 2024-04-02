CREATE TABLE IF NOT EXISTS `BankTransactions` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`category_id` text,
	`status` text NOT NULL,
	`booking_date` timestamp,
	`value_date` timestamp,
	`amount` text NOT NULL,
	`currency` text NOT NULL,
	`exchange_rate` text,
	`creditor_name` text,
	`creditor_bban` text,
	`debtor_name` text,
	`debtor_bban` text,
	`additional_information` text,
	`spending_type` text,
	`want_or_need` text,
	FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `Accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `Categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS  `unique_external_id` ON `BankTransactions` (`user_id`,`transaction_id`);