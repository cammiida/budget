CREATE TABLE IF NOT EXISTS `Categories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category_group_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`keywords` text,
	FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_group_id`) REFERENCES `CategoryGroups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `unique_on` ON `Categories` (`user_id`,`name`);