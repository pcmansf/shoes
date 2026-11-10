CREATE TABLE IF NOT EXISTS shoes (id TEXT PRIMARY KEY NOT NULL, owner TEXT NOT NULL, shoe_id TEXT NOT NULL COLLATE NOCASE, data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(owner,shoe_id));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS collection_settings (owner TEXT PRIMARY KEY NOT NULL, initialized INTEGER NOT NULL DEFAULT 1);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY NOT NULL,
  owner TEXT NOT NULL,
  name TEXT NOT NULL COLLATE NOCASE,
  icon TEXT NOT NULL DEFAULT 'pin',
  revision INTEGER NOT NULL DEFAULT 1,
  UNIQUE(owner,name)
);
