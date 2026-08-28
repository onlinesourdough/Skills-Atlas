import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "atlas_session";
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const MAX_SESSIONS = 100;

interface SessionRecord {
  expiresAt: number;
  createdAt: number;
}

export interface SessionStoreOptions {
  now?: () => number;
  randomToken?: () => string;
  ttlMs?: number;
  maxSessions?: number;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function cookieValue(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    const value = part.slice(separator + 1).trim();
    if (/^[A-Za-z0-9_-]{20,160}$/u.test(value)) return value;
  }
  return undefined;
}

export class SessionStore {
  readonly available: boolean;
  private readonly passwordDigest?: Buffer;
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly now: () => number;
  private readonly randomToken: () => string;
  private readonly ttlMs: number;
  private readonly maxSessions: number;

  constructor(password: string | undefined, options: SessionStoreOptions = {}) {
    const normalized = password?.trim();
    this.available = Boolean(normalized);
    if (normalized) this.passwordDigest = digest(normalized);
    this.now = options.now ?? Date.now;
    this.randomToken = options.randomToken ?? (() => randomBytes(32).toString("base64url"));
    this.ttlMs = options.ttlMs ?? SESSION_TTL_MS;
    this.maxSessions = options.maxSessions ?? MAX_SESSIONS;
  }

  login(password: string): string | null {
    if (!this.passwordDigest || !this.available) return null;
    if (!timingSafeEqual(this.passwordDigest, digest(password))) return null;
    this.prune();
    if (this.sessions.size >= this.maxSessions) {
      const oldest = [...this.sessions.entries()].sort(
        (left, right) => left[1].createdAt - right[1].createdAt,
      )[0]?.[0];
      if (oldest) this.sessions.delete(oldest);
    }
    const token = this.randomToken();
    const now = this.now();
    this.sessions.set(token, { createdAt: now, expiresAt: now + this.ttlMs });
    return token;
  }

  authenticated(token: string | undefined): boolean {
    if (!token) return false;
    const record = this.sessions.get(token);
    if (!record) return false;
    if (record.expiresAt <= this.now()) {
      this.sessions.delete(token);
      return false;
    }
    return true;
  }

  logout(token: string | undefined): void {
    if (token) this.sessions.delete(token);
  }

  private prune(): void {
    const now = this.now();
    for (const [token, record] of this.sessions) {
      if (record.expiresAt <= now) this.sessions.delete(token);
    }
  }
}

export function sessionCookie(token: string, secure: boolean): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

export function expiredSessionCookie(secure: boolean): string {
  return [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}
