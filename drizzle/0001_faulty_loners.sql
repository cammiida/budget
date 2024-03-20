CREATE TABLE IF NOT EXISTS `Banks` (
	`bank_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`requisition_id` text,
	`logo` text,
	`bic` text,
	PRIMARY KEY(`bank_id`, `user_id`),
	FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON UPDATE no action ON DELETE cascade
);