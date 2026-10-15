-- 002_skills.sql — Skills system

CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  input_schema_json TEXT NOT NULL,
  output_schema_json TEXT NOT NULL,
  required_capabilities_json TEXT NOT NULL DEFAULT '[]',
  permissions_json TEXT NOT NULL DEFAULT '[]',
  allowed_tools_json TEXT NOT NULL DEFAULT '[]',
  executable INTEGER NOT NULL DEFAULT 0 CHECK (executable = 0),  -- hard rule: skills are declarative
  enabled INTEGER NOT NULL DEFAULT 1,
  built_in INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (name, version, author_id)
);
CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);
CREATE INDEX IF NOT EXISTS idx_skills_author ON skills(author_id);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preferences_json TEXT NOT NULL DEFAULT '{}',
  memories_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);
