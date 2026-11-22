PRAGMA foreign_keys = OFF;
BEGIN IMMEDIATE;
CREATE TABLE collections_v2 (
 id TEXT PRIMARY KEY, key TEXT NOT NULL UNIQUE,
 kind TEXT NOT NULL CHECK(kind IN ('dialogue','midterm','reading','custom')),
 title TEXT NOT NULL, lesson_number INTEGER, dialog_number INTEGER,
 metadata TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(metadata)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 revision INTEGER NOT NULL DEFAULT 1
);
INSERT INTO collections_v2(id,key,kind,title,lesson_number,dialog_number,metadata,created_at)
 SELECT id,key,kind,title,lesson_number,dialog_number,metadata,created_at FROM collections;
DROP TABLE collections;
ALTER TABLE collections_v2 RENAME TO collections;
ALTER TABLE section_items ADD COLUMN was_new INTEGER NOT NULL DEFAULT 0;
CREATE TABLE import_requests (request_id TEXT PRIMARY KEY, collection_id TEXT NOT NULL REFERENCES collections(id));
UPDATE app_meta SET value='2' WHERE key='schema_version';
COMMIT;
PRAGMA foreign_keys = ON;
