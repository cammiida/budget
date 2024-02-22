CREATE TABLE IF NOT EXISTS `user` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`avatar` text,
	`name` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `emailIdx` ON `user` (`email`);