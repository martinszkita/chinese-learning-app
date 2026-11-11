PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY, key TEXT NOT NULL UNIQUE, kind TEXT NOT NULL CHECK(kind IN ('dialogue','midterm','reading')),
  title TEXT NOT NULL, lesson_number INTEGER, dialog_number INTEGER, metadata TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(metadata)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY, collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('dialogue','vocabulary','examples','questions','reading')), title TEXT NOT NULL,
  position INTEGER NOT NULL CHECK(position >= 0), UNIQUE(collection_id, position)
);
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY, chinese_traditional TEXT NOT NULL CHECK(length(trim(chinese_traditional)) > 0), chinese_simplified TEXT,
  pinyin TEXT NOT NULL DEFAULT '', english TEXT NOT NULL DEFAULT '', part_of_speech TEXT NOT NULL DEFAULT '',
  aliases TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(aliases)), metadata TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(metadata)),
  revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('audio','image','document')), path TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT '', voice TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS section_items (
  id TEXT PRIMARY KEY, section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id), position INTEGER NOT NULL CHECK(position >= 0),
  speaker TEXT NOT NULL DEFAULT '', speaker_pinyin TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '',
  audio_asset_id TEXT REFERENCES assets(id), UNIQUE(section_id, position)
);
CREATE INDEX IF NOT EXISTS sections_collection ON sections(collection_id);
CREATE INDEX IF NOT EXISTS section_items_item ON section_items(item_id);
CREATE INDEX IF NOT EXISTS items_chinese ON items(chinese_traditional);
-- Job execution/authentication will be connected in a later stage. No passwords or API keys belong in material rows.
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('import','generate_audio')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','completed','failed')),
  payload TEXT NOT NULL CHECK(json_valid(payload)), error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO app_meta(key,value) VALUES ('schema_version','1');
