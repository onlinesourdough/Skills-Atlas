-- Upgrade invalidates browser access. Profile/source preferences survive.
DELETE FROM sessions;
DELETE FROM oauth_attempts;
ALTER TABLE oauth_attempts ADD COLUMN return_to TEXT;
ALTER TABLE sessions DROP COLUMN token_ciphertext;
ALTER TABLE sessions ADD COLUMN credential_id TEXT NOT NULL DEFAULT '';
CREATE TABLE credentials (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  token_ciphertext TEXT NOT NULL,
  policy_key TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX credentials_user ON credentials(user_id);
CREATE TABLE agent_connections (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL REFERENCES credentials(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  grant_id TEXT,
  policy_key TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX agent_connections_user ON agent_connections(user_id);
CREATE TABLE agent_consents (
  id TEXT PRIMARY KEY,
  session_hash TEXT NOT NULL,
  request_json TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE agent_registration_limits (
  bucket INTEGER PRIMARY KEY,
  count INTEGER NOT NULL
);
CREATE TABLE agent_refresh_uses (
  token_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
