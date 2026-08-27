CREATE TABLE `process_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`toolKey` varchar(64) NOT NULL,
	`toolName` varchar(128) NOT NULL,
	`status` enum('completed') NOT NULL DEFAULT 'completed',
	`inputFileNames` text NOT NULL,
	`outputFilename` varchar(255) NOT NULL,
	`totalRecords` int NOT NULL DEFAULT 0,
	`completedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `process_history_id` PRIMARY KEY(`id`)
);
