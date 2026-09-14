import { AtlasError, MAX_SOURCES } from "./security.js";

export interface SessionRow {
  session_hash: string;
  browser_hash: string;
  user_id: number;
  login: string;
  credential_id: string;
  token_ciphertext: string;
  csrf_token: string;
  policy_key: string;
  expires_at: number;
}

export interface AttemptRow {
  return_to?: string | null;
  state_hash: string;
  browser_hash: string;
  verifier_ciphertext: string;
  expires_at: number;
}

export interface SourceRow {
  id: string;
  user_id: number;
  repository_id: number | null;
  repository: string;
  visible: number;
}

export class ProfileStore {
  constructor(private readonly db: D1Database) {}

  async startAttempt(row: AttemptRow, oldSessionHash: string, now: number): Promise<void> {
    await this.db.batch([
      this.db
        .prepare(
          "DELETE FROM agent_consents WHERE expires_at <= ? OR session_hash NOT IN (SELECT session_hash FROM sessions)",
        )
        .bind(now),
      this.db.prepare("DELETE FROM agent_connections WHERE expires_at <= ?").bind(now),
      this.db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now),
      this.db
        .prepare(
          "DELETE FROM credentials WHERE expires_at <= ? OR (id NOT IN (SELECT credential_id FROM sessions) AND id NOT IN (SELECT credential_id FROM agent_connections))",
        )
        .bind(now),
      this.db.prepare("DELETE FROM agent_refresh_uses WHERE expires_at <= ?").bind(now),
    ]);
    const results = await this.db.batch([
      this.db
        .prepare("DELETE FROM oauth_attempts WHERE browser_hash = ? OR expires_at <= ?")
        .bind(row.browser_hash, now),
      this.db
        .prepare(
          "DELETE FROM sessions WHERE session_hash = ? OR browser_hash = ? OR expires_at <= ?",
        )
        .bind(oldSessionHash, row.browser_hash, now),
      this.db
        .prepare(
          "INSERT INTO oauth_attempts (state_hash, browser_hash, verifier_ciphertext, expires_at, return_to) SELECT ?, ?, ?, ?, ? WHERE (SELECT count(*) FROM oauth_attempts) < 1000",
        )
        .bind(
          row.state_hash,
          row.browser_hash,
          row.verifier_ciphertext,
          row.expires_at,
          row.return_to ?? null,
        ),
    ]);
    if (results[2]?.meta.changes !== 1) throw new AtlasError("login-rate-limited", 429);
  }

  async consumeAttempt(stateHash: string, browserHash: string): Promise<AttemptRow | null> {
    return this.db
      .prepare(
        "UPDATE oauth_attempts SET consumed = 1 WHERE state_hash = ? AND browser_hash = ? AND consumed = 0 RETURNING state_hash, browser_hash, verifier_ciphertext, expires_at, return_to",
      )
      .bind(stateHash, browserHash)
      .first<AttemptRow>();
  }

  async discardAttempt(stateHash: string): Promise<void> {
    await this.db.prepare("DELETE FROM oauth_attempts WHERE state_hash = ?").bind(stateHash).run();
  }

  async completeLogin(
    row: SessionRow,
    attemptHash: string,
    defaultRepository: string,
    now: number,
  ): Promise<void> {
    const validFlow =
      "EXISTS (SELECT 1 FROM oauth_attempts WHERE state_hash = ? AND consumed = 1 AND expires_at > ?)";
    const result = await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO profiles (user_id, login, created_at) SELECT ?, ?, ? WHERE ${validFlow} ON CONFLICT(user_id) DO UPDATE SET login = excluded.login`,
        )
        .bind(row.user_id, row.login, now, attemptHash, now),
      this.db
        .prepare(
          `INSERT INTO sources (id, user_id, repository, visible, created_at) SELECT ?, user_id, ?, 1, ? FROM profiles WHERE user_id = ? AND default_seeded = 0 AND ${validFlow} ON CONFLICT(user_id, repository) DO NOTHING`,
        )
        .bind(crypto.randomUUID(), defaultRepository, now, row.user_id, attemptHash, now),
      this.db
        .prepare(`UPDATE profiles SET default_seeded = 1 WHERE user_id = ? AND ${validFlow}`)
        .bind(row.user_id, attemptHash, now),
      this.db
        .prepare(
          `INSERT INTO credentials (id, user_id, token_ciphertext, policy_key, expires_at) SELECT ?, ?, ?, ?, ? WHERE ${validFlow}`,
        )
        .bind(
          row.credential_id,
          row.user_id,
          row.token_ciphertext,
          row.policy_key,
          row.expires_at,
          attemptHash,
          now,
        ),
      this.db
        .prepare(
          `INSERT INTO sessions (session_hash, browser_hash, user_id, credential_id, csrf_token, policy_key, expires_at, created_at) SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE ${validFlow}`,
        )
        .bind(
          row.session_hash,
          row.browser_hash,
          row.user_id,
          row.credential_id,
          row.csrf_token,
          row.policy_key,
          row.expires_at,
          now,
          attemptHash,
          now,
        ),
      this.db.prepare("DELETE FROM oauth_attempts WHERE state_hash = ?").bind(attemptHash),
    ]);
    if (result[4]?.meta.changes !== 1) throw new AtlasError("oauth-expired", 400);
  }

  async session(sessionHash: string): Promise<SessionRow | null> {
    return this.db
      .prepare(
        "SELECT s.*, p.login, c.token_ciphertext FROM sessions s JOIN profiles p ON p.user_id = s.user_id JOIN credentials c ON c.id = s.credential_id AND c.user_id = s.user_id AND c.policy_key = s.policy_key WHERE session_hash = ? AND c.expires_at >= s.expires_at",
      )
      .bind(sessionHash)
      .first<SessionRow>();
  }

  async logout(sessionHash: string, browserHash: string): Promise<void> {
    await this.db.batch([
      this.db
        .prepare("DELETE FROM sessions WHERE session_hash = ? OR browser_hash = ?")
        .bind(sessionHash, browserHash),
      this.db.prepare("DELETE FROM oauth_attempts WHERE browser_hash = ?").bind(browserHash),
    ]);
  }

  async revokeUser(userId: number): Promise<void> {
    await this.db.batch([
      this.db
        .prepare(
          "DELETE FROM agent_consents WHERE session_hash IN (SELECT session_hash FROM sessions WHERE user_id = ?)",
        )
        .bind(userId),
      this.db.prepare("DELETE FROM agent_connections WHERE user_id = ?").bind(userId),
      this.db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId),
      this.db.prepare("DELETE FROM credentials WHERE user_id = ?").bind(userId),
    ]);
  }

  async assertCurrent(session: SessionRow, now: number): Promise<void> {
    const current = await this.session(session.session_hash);
    if (
      !current ||
      current.user_id !== session.user_id ||
      current.expires_at <= now ||
      current.policy_key !== session.policy_key
    )
      throw new AtlasError("session-expired", 401);
  }

  async sources(userId: number): Promise<SourceRow[]> {
    const result = await this.db
      .prepare(
        "SELECT id, user_id, repository_id, repository, visible FROM sources WHERE user_id = ? ORDER BY created_at, id LIMIT ?",
      )
      .bind(userId, MAX_SOURCES)
      .all<SourceRow>();
    return result.results;
  }

  async source(userId: number, id: string): Promise<SourceRow> {
    const source = await this.db
      .prepare(
        "SELECT id, user_id, repository_id, repository, visible FROM sources WHERE user_id = ? AND id = ?",
      )
      .bind(userId, id)
      .first<SourceRow>();
    if (!source) throw new AtlasError("source-unavailable", 404);
    return source;
  }

  async saveSource(
    session: SessionRow,
    repositoryId: number,
    repository: string,
    now: number,
  ): Promise<SourceRow> {
    // The final SQL session predicate prevents an in-flight import from writing after logout.
    const current = await this.db
      .prepare("SELECT id FROM sources WHERE user_id = ? AND (repository_id = ? OR repository = ?)")
      .bind(session.user_id, repositoryId, repository)
      .first<{ id: string }>();
    const id = crypto.randomUUID();
    const result = await this.db
      .prepare(
        `INSERT INTO sources (id, user_id, repository_id, repository, visible, created_at)
      SELECT ?, ?, ?, ?, 1, ? WHERE EXISTS (SELECT 1 FROM sessions WHERE session_hash = ? AND user_id = ? AND expires_at > ?)
      AND ((SELECT count(*) FROM sources WHERE user_id = ?) < ? OR EXISTS (SELECT 1 FROM sources WHERE id = ? AND user_id = ?))
      ON CONFLICT(user_id, repository_id) DO UPDATE SET repository = excluded.repository
      ON CONFLICT(user_id, repository) DO UPDATE SET repository_id = excluded.repository_id
      WHERE sources.repository_id IS NULL OR sources.repository_id = excluded.repository_id`,
      )
      .bind(
        id,
        session.user_id,
        repositoryId,
        repository,
        now,
        session.session_hash,
        session.user_id,
        now,
        session.user_id,
        MAX_SOURCES,
        current?.id ?? id,
        session.user_id,
      )
      .run();
    if (!result.meta.changes) {
      await this.assertCurrent(session, now);
      const collision = await this.db
        .prepare("SELECT repository_id FROM sources WHERE user_id = ? AND repository = ?")
        .bind(session.user_id, repository)
        .first<{ repository_id: number | null }>();
      if (collision?.repository_id && collision.repository_id !== repositoryId)
        throw new AtlasError("source-name-changed", 409);
      throw new AtlasError("source-limit", 409);
    }
    const source = await this.db
      .prepare(
        "SELECT id, user_id, repository_id, repository, visible FROM sources WHERE user_id = ? AND repository_id = ?",
      )
      .bind(session.user_id, repositoryId)
      .first<SourceRow>();
    if (!source) throw new AtlasError("source-unavailable", 404);
    return source;
  }

  async identifySource(
    session: SessionRow,
    id: string,
    repositoryId: number,
    repository: string,
    now: number,
  ): Promise<void> {
    const result = await this.db
      .prepare(
        "UPDATE sources SET repository_id = ?, repository = ? WHERE user_id = ? AND id = ? AND EXISTS (SELECT 1 FROM sessions WHERE session_hash = ? AND user_id = ? AND expires_at > ?)",
      )
      .bind(
        repositoryId,
        repository,
        session.user_id,
        id,
        session.session_hash,
        session.user_id,
        now,
      )
      .run();
    if (result.meta.changes !== 1) throw new AtlasError("source-unavailable", 404);
  }

  async setVisible(session: SessionRow, id: string, visible: boolean, now: number): Promise<void> {
    const result = await this.db
      .prepare(
        "UPDATE sources SET visible = ? WHERE user_id = ? AND id = ? AND EXISTS (SELECT 1 FROM sessions WHERE session_hash = ? AND user_id = ? AND expires_at > ?)",
      )
      .bind(visible ? 1 : 0, session.user_id, id, session.session_hash, session.user_id, now)
      .run();
    if (result.meta.changes !== 1) throw new AtlasError("source-unavailable", 404);
  }

  async removeSource(session: SessionRow, id: string, now: number): Promise<void> {
    const result = await this.db
      .prepare(
        "DELETE FROM sources WHERE user_id = ? AND id = ? AND EXISTS (SELECT 1 FROM sessions WHERE session_hash = ? AND user_id = ? AND expires_at > ?)",
      )
      .bind(session.user_id, id, session.session_hash, session.user_id, now)
      .run();
    if (result.meta.changes !== 1) throw new AtlasError("source-unavailable", 404);
  }
}
