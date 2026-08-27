CREATE TABLE `user_process_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`retentionDays` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_process_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_process_settings_userId_unique` UNIQUE(`userId`)
);
