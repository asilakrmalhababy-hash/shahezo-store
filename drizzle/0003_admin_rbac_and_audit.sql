CREATE TABLE IF NOT EXISTS admin_staff (
  id int AUTO_INCREMENT NOT NULL,
  userId int NULL,
  username varchar(120) NOT NULL,
  displayName varchar(160) NOT NULL,
  passwordHash varchar(255) NOT NULL,
  roleKey varchar(40) NOT NULL DEFAULT 'staff',
  permissionsJson text NOT NULL,
  isActive boolean NOT NULL DEFAULT true,
  mustChangePassword boolean NOT NULL DEFAULT true,
  sessionVersion int NOT NULL DEFAULT 1,
  createdBy varchar(160) NULL,
  lastLoginAt timestamp NULL,
  createdAt timestamp NOT NULL DEFAULT (now()),
  updatedAt timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT admin_staff_id PRIMARY KEY(id),
  CONSTRAINT admin_staff_username_uq UNIQUE(username)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id int AUTO_INCREMENT NOT NULL,
  actorId int NULL,
  actorName varchar(160) NOT NULL,
  actorRole varchar(60) NOT NULL,
  action varchar(80) NOT NULL,
  targetName varchar(160) NULL,
  details text NULL,
  ipAddress varchar(80) NULL,
  createdAt timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT admin_audit_logs_id PRIMARY KEY(id)
);
