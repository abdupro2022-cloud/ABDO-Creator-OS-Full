-- 005_scripts_and_community.sql — Script Studio persistence + community publishing

CREATE TABLE IF NOT EXISTS scripts (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  hook TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  outro TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scripts_owner ON scripts(owner_id);
CREATE INDEX IF NOT EXISTS idx_scripts_project ON scripts(project_id);

CREATE TABLE IF NOT EXISTS script_revisions (
  id TEXT PRIMARY KEY,
  script_id TEXT NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  hook TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  outro TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_script_revisions_script ON script_revisions(script_id);

CREATE TABLE IF NOT EXISTS community_skill_publishes (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  publisher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL CHECK (state IN ('draft', 'pending_review', 'published', 'rejected', 'removed')),
  moderator_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  moderation_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_community_skill_publishes_state ON community_skill_publishes(state);
CREATE INDEX IF NOT EXISTS idx_community_skill_publishes_publisher ON community_skill_publishes(publisher_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
