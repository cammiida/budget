ALTER TABLE Budgets ADD `name` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `unique_on` ON `Budgets` (`user_id`,`name`);--> statement-breakpoint
ALTER TABLE `Budgets` DROP COLUMN `start_date`;--> statement-breakpoint
ALTER TABLE `Budgets` DROP COLUMN `end_date`;