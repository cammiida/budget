CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`avatar` text,
	`name` text
);

CREATE UNIQUE INDEX `emailIdx` ON `users` (`email`);