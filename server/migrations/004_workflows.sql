-- 004_workflows.sql — Multi-agent workflow runs, steps, and project-scoped conversations

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_id);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  task_class TEXT NOT NULL CHECK (task_class IN ('simple', 'standard', 'full')),
  user_prompt TEXT NOT NULL,
  role_guidance TEXT,
  provider_config_id TEXT REFERENCES user_provider_configs(id) ON DELETE SET NULL,
  model TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  current_step TEXT,
  final_output_json TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_owner ON workflow_runs(owner_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_project ON workflow_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);

CREATE TABLE IF NOT EXISTS workflow_steps (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL,
  role TEXT NOT NULL,
  input_json TEXT NOT NULL,
  output_json TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  UNIQUE (run_id, step_index)
);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_run ON workflow_steps(run_id);
