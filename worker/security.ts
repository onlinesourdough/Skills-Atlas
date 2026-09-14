import { timingSafeEqual } from "node:crypto";
import { isRepositoryName } from "../src/domain/contracts.js";

export const READ_LEASE_MS = 5 * 60 * 1000;
export const SESSION_MS = 8 * 60 * 60 * 1000;
export const OAUTH_MS = 10 * 60 * 1000;
export const MAX_SOURCES = 20;

export class AtlasError extends Error {
  constructor(
    readonly code: string,
    readonly status = 400,
    cause?: unknown,
  ) {
    super(code, { cause });
  }
}

// URL parsing alone permits hosts such as '*' and 'example.com;script-src'.
// Use one literal-source check at registration and when consuming stored metadata.
export function callbackFormSource(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 1024 ||
    [...value].some(
      (char) =>
        char.charCodeAt(0) <= 32 || (char.charCodeAt(0) >= 127 && char.charCodeAt(0) <= 159),
    )
  )
    throw new AtlasError("invalid-request");
  try {
    const url = new URL(value);
    if (
      url.username ||
      url.password ||
      url.hash ||
      !/^(?:[a-z0-9-]+(?:\.[a-z0-9-]+)*\.?|\[[a-f0-9:]+\])$/iu.test(url.hostname) ||
      !(
        url.protocol === "https:" ||
        (url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))
      )
    )
      throw new AtlasError("invalid-request");
    // Query matching remains the OAuth provider's exact-URI responsibility.
    const path = url.pathname
      .split("/")
      .map((part) =>
        encodeURIComponent(decodeURIComponent(part)).replace(
          /[!'()*]/gu,
          (char) => `%${char.charCodeAt(0).toString(16)}`,
        ),
      )
      .join("/");
    return `${url.origin}${path}`;
  } catch {
    throw new AtlasError("invalid-request");
  }
}

export interface DeploymentPolicy {
  origin: string;
  deployment: "hosted" | "self-hosted";
  organization: string | null;
  allowedUserIds: number[];
  defaultRepository: string;
  clientId: string;
  clientSecret: string;
  encryptionKey: string;
  secure: boolean;
  callback: string;
  key: string;
}

export async function hash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function equalSecret(left: string, right: string): Promise<boolean> {
  const [a, b] = await Promise.all([hash(left), hash(right)]);
  return timingSafeEqual(new TextEncoder().encode(a), new TextEncoder().encode(b));
}

export function randomSecret(): string {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

function base64url(value: Uint8Array): string {
  return btoa(String.fromCharCode(...value))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function fromBase64url(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), (character) =>
    character.charCodeAt(0),
  );
}

export async function deploymentPolicy(env: Env): Promise<DeploymentPolicy> {
  try {
    const origin = new URL(env.ATLAS_ORIGIN);
    const local =
      env.ATLAS_LOCAL_HTTP === "true" &&
      origin.protocol === "http:" &&
      ["127.0.0.1", "localhost"].includes(origin.hostname);
    if (
      origin.origin !== env.ATLAS_ORIGIN ||
      (!local && origin.protocol !== "https:") ||
      origin.username ||
      origin.password ||
      !["hosted", "self-hosted"].includes(env.ATLAS_DEPLOYMENT) ||
      !/^[A-Za-z0-9._-]{8,100}$/u.test(env.GITHUB_CLIENT_ID) ||
      !env.GITHUB_CLIENT_SECRET ||
      env.GITHUB_CLIENT_SECRET.length > 1024 ||
      !/^[A-Za-z0-9+/]{43}=$/u.test(env.ATLAS_ENCRYPTION_KEY) ||
      atob(env.ATLAS_ENCRYPTION_KEY).length !== 32 ||
      !isRepositoryName(env.ATLAS_DEFAULT_REPOSITORY)
    )
      throw new Error("config");
    const organization = env.ATLAS_ALLOWED_ORG.trim().toLowerCase() || null;
    const rawIds = env.ATLAS_ALLOWED_USER_IDS.trim();
    const allowedUserIds = rawIds ? rawIds.split(",").map((id) => Number(id.trim())) : [];
    if (organization && !/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/u.test(organization))
      throw new Error("org");
    if (
      allowedUserIds.length > 100 ||
      allowedUserIds.some((id) => !Number.isSafeInteger(id) || id <= 0)
    )
      throw new Error("allowlist");
    if (env.ATLAS_DEPLOYMENT === "hosted") {
      if (local || organization !== "onlinesourdough" || allowedUserIds.length)
        throw new Error("hosted-policy");
    } else if (Boolean(organization) === Boolean(allowedUserIds.length))
      throw new Error("self-host-policy");
    const key = await hash(
      JSON.stringify([
        origin.origin,
        env.ATLAS_DEPLOYMENT,
        organization,
        [...allowedUserIds].sort(),
        env.GITHUB_CLIENT_ID,
      ]),
    );
    return {
      origin: origin.origin,
      deployment: env.ATLAS_DEPLOYMENT as "hosted" | "self-hosted",
      organization,
      allowedUserIds,
      defaultRepository: env.ATLAS_DEFAULT_REPOSITORY,
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      encryptionKey: env.ATLAS_ENCRYPTION_KEY,
      secure: !local,
      callback: `${origin.origin}/auth/github/callback`,
      key,
    };
  } catch {
    throw new AtlasError("login-unavailable", 503);
  }
}

async function encryptionKey(secret: string): Promise<CryptoKey> {
  const bytes = Uint8Array.from(atob(secret), (character) => character.charCodeAt(0));
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function seal(value: string, secret: string, context: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(context) },
    await encryptionKey(secret),
    new TextEncoder().encode(value),
  );
  return `${base64url(iv)}.${base64url(new Uint8Array(ciphertext))}`;
}

export async function unseal(value: string, secret: string, context: string): Promise<string> {
  try {
    const parts = value.split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error("ciphertext");
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: fromBase64url(parts[0]),
        additionalData: new TextEncoder().encode(context),
      },
      await encryptionKey(secret),
      fromBase64url(parts[1]),
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    throw new AtlasError("session-expired", 401);
  }
}

export function cookieName(policy: DeploymentPolicy, kind: "session" | "oauth"): string {
  return `${policy.secure ? "__Host-atlas" : "atlas_local"}_${kind}`;
}

export function readCookie(request: Request, name: string): string | null {
  const matches = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item.startsWith(`${name}=`));
  if (matches.length !== 1) return null;
  const value = matches[0]!.slice(name.length + 1);
  return /^[A-Za-z0-9_-]{43}$/u.test(value) ? value : null;
}

export function cookie(
  policy: DeploymentPolicy,
  kind: "session" | "oauth",
  value: string,
  lifetime: number,
): string {
  return `${cookieName(policy, kind)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.max(0, Math.floor(lifetime / 1000))}${policy.secure ? "; Secure" : ""}`;
}

export function requireOrigin(request: Request, policy: DeploymentPolicy, mutation = false): void {
  const origin = request.headers.get("origin");
  if (
    new URL(request.url).origin !== policy.origin ||
    (origin !== null && origin !== policy.origin) ||
    (mutation && origin !== policy.origin) ||
    (request.headers.get("sec-fetch-site") === "cross-site" &&
      new URL(request.url).pathname.startsWith("/api/"))
  ) {
    throw new AtlasError("origin-denied", 403);
  }
}

export async function boundedText(
  response: Response | Request,
  maximum = 64 * 1024,
): Promise<string> {
  if (Number(response.headers.get("content-length")) > maximum)
    throw new AtlasError("payload-too-large", 413);
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maximum) throw new AtlasError("payload-too-large", 413);
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  const data = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(data);
}

export async function requestJson(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json")
    throw new AtlasError("invalid-request");
  try {
    const value: unknown = JSON.parse(await boundedText(request, 8192));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("body");
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof AtlasError) throw error;
    throw new AtlasError("invalid-request");
  }
}
