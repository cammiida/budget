
PRAGMA foreign_keys=off;

BEGIN TRANSACTION;

ALTER TABLE `transaction` RENAME TO `transaction_old`;

CREATE TABLE IF NOT EXISTS `transaction` (
	`transaction_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`bank_id` text NOT NULL,
	`account_id` text NOT NULL,
	`category_id` integer,
	`status` text NOT NULL,
	`booking_date` timestamp,
	`value_date` timestamp,
	`amount` text NOT NULL,
	`currency` text NOT NULL,
	`creditor_name` text,
	`debtor_name` text,
    `exchange_rate` text,
    `creditor_bban` text,
    `debtor_bban` text,
    `additional_information` text,
	PRIMARY KEY(`account_id`, `transaction_id`, `user_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`,`bank_id`,`account_id`) REFERENCES `account`(`user_id`,`bank_id`,`account_id`) ON UPDATE no action ON DELETE cascade
);

INSERT INTO `transaction` SELECT * FROM `transaction_old`;

DROP TABLE `transaction_old`;

COMMIT;

PRAGMA foreign_keys=on;
