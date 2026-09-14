-- Each deployment owns its database. No GitHub skill bodies are stored here.
CREATE TABLE profiles (
  user_id INTEGER PRIMARY KEY CHECK (user_id > 0),
  login TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  default_seeded INTEGER NOT NULL DEFAULT 0 CHECK (default_seeded IN (0, 1))
);

CREATE TABLE oauth_attempts (
  state_hash TEXT PRIMARY KEY,
  browser_hash TEXT NOT NULL,
  verifier_ciphertext TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed INTEGER NOT NULL DEFAULT 0 CHECK (consumed IN (0, 1))
);
CREATE INDEX oauth_attempts_browser ON oauth_attempts(browser_hash);
CREATE INDEX oauth_attempts_expiry ON oauth_attempts(expires_at);

CREATE TABLE sessions (
  session_hash TEXT PRIMARY KEY,
  browser_hash TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  token_ciphertext TEXT NOT NULL,
  csrf_token TEXT NOT NULL,
  policy_key TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX sessions_browser ON sessions(browser_hash);
CREATE INDEX sessions_expiry ON sessions(expires_at);

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  repository_id INTEGER CHECK (repository_id > 0),
  repository TEXT NOT NULL COLLATE NOCASE,
  visible INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0, 1)),
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, repository_id),
  UNIQUE (user_id, repository)
);
CREATE INDEX sources_user ON sources(user_id, created_at);
