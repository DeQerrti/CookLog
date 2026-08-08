CREATE TABLE IF NOT EXISTS recipes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,
  image_url     TEXT,
  type          TEXT,
  method        TEXT,
  time_minutes  INTEGER,
  ingredients   TEXT,   -- JSON-массив строк
  steps         TEXT,   -- JSON-массив строк
  tags          TEXT,   -- JSON-массив строк
  source_label  TEXT,
  source_url    TEXT,
  emoji         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON recipes(created_at);
