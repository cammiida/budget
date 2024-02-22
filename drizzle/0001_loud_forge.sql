CREATE TABLE IF NOT EXISTS `bank` (
	`requisition_id` text,
	`user_id` integer NOT NULL,
	`bank_id` text NOT NULL,
	`name` text NOT NULL,
	`logo` text,
	`bic` text,
	PRIMARY KEY(`bank_id`, `user_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
