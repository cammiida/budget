CREATE TABLE IF NOT EXISTS `CategoryGroups` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`budgetId` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`budgetId`) REFERENCES `Budgets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `unique_on` ON `CategoryGroups` (`userId`,`name`);