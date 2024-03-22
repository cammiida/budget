CREATE TABLE `Budgets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`start_date` timestamp NOT NULL,
	`end_date` timestamp NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `Users`(`id`) ON UPDATE no action ON DELETE cascade
);
