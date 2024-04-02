CREATE TABLE IF NOT EXISTS `Users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `emailIdx` ON `Users` (`email`);