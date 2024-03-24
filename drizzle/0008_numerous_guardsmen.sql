CREATE TABLE `CategoryGroups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`budgetId` integer NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`budgetId`) REFERENCES `Budgets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=off;

BEGIN TRANSACTION;

ALTER TABLE Categories RENAME TO _Categories_old;

CREATE TABLE IF NOT EXISTS `Categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`category_group_id` integer NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`keywords` text,
	FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON UPDATE no action ON DELETE cascade
	FOREIGN KEY (`category_group_id`) REFERENCES `CategoryGroups`(`id`) ON UPDATE no action ON DELETE cascade
);

COMMIT;

PRAGMA foreign_keys=on;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `unique_on` ON `Categories` (`user_id`,`name`);
--> statement-breakpoint
DROP TABLE _Categories_old;