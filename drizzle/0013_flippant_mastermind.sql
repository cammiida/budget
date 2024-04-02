CREATE TABLE IF NOT EXISTS `Banks` (
	`id` text PRIMARY KEY NOT NULL,
	`bank_id` text NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`requisition_id` text,
	`logo` text,
	`bic` text,
	FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `unique_on` ON `Banks` (`user_id`,`bank_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `unique_name` ON `Banks` (`user_id`,`name`);