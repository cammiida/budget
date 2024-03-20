CREATE TABLE IF NOT EXISTS `Users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `emailIdx` ON `Users` (`email`);