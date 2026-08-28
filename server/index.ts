import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseProposalRequest } from "../src/domain/contracts.js";
import {
  createGitHubFetchTransport,
  ProviderError,
  type ProviderErrorCode,
  proposeGitHubChange,
  readGitHubPack,
} from "../src/domain/github.js";
import type { AtlasHealth, SessionState } from "../src/types.js";
import {
  cookieValue,
  expiredSessionCookie,
  SESSION_COOKIE,
  sessionCookie,
  SessionStore,
} from "./session.js";

const clientRoot = fileURLToPath(new URL("../client", import.meta.url));
const defaultPort = 4173;
const requestTimeoutMs = 8000;
const maxJsonBytes = 132 * 1024;
const securityHeaders = {
  "content-security-policy":
    "default-src 'self'; connect-src 'self'; font-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
};

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

export interface AtlasRuntimeConfig {
  adminPassword?: string;
  githubToken?: string;
  secureCookie?: boolean;
  fetcher?: typeof fetch;
}

interface ErrorDescriptor {
  status: number;
  code: string;
  message: string;
}

function portFromEnvironment(): number {
  const candidate = Number.parseInt(process.env.PORT ?? "", 10);
  return Number.isInteger(candidate) && candidate >= 1024 && candidate <= 65535
    ? candidate
    : defaultPort;
}

function sendJson(
  response: ServerResponse,
  status: number,
  payload: unknown,
  headers: Record<string, string> = {},
): void {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    ...securityHeaders,
    ...headers,
  });
  response.end(body);
}

function sendError(response: ServerResponse, status: number, code: string, message: string): void {
  sendJson(response, status, { error: { code, message } });
}

function requestUrl(request: IncomingMessage): URL | null {
  try {
    return new URL(request.url ?? "/", "http://atlas.local");
  } catch {
    return null;
  }
}

async function sendStatic(response: ServerResponse, route: string): Promise<void> {
  const requested = route === "/" ? "/index.html" : route;
  const candidate = resolve(clientRoot, `.${requested}`);
  const distance = relative(clientRoot, candidate);
  if (distance.startsWith("..") || distance.includes("\u0000")) {
    sendError(response, 400, "unsafe-path", "That asset path is not available.");
    return;
  }
  let info;
  try {
    info = await lstat(candidate);
  } catch {
    if (!extname(requested)) {
      await sendStatic(response, "/index.html");
      return;
    }
    sendError(response, 404, "not-found", "The requested asset was not found.");
    return;
  }
  if (info.isSymbolicLink() || !info.isFile()) {
    sendError(response, 404, "not-found", "The requested asset was not found.");
    return;
  }
  response.writeHead(200, {
    "cache-control": "no-cache",
    "content-type": contentTypes[extname(candidate)] ?? "application/octet-stream",
    "content-length": info.size,
    ...securityHeaders,
  });
  createReadStream(candidate).pipe(response);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const contentType = request.headers["content-type"] ?? "";
  if (!contentType.toLocaleLowerCase().startsWith("application/json")) {
    throw new Error("content-type");
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxJsonBytes) throw new Error("body-too-large");
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new Error("invalid-json");
  }
}

function sameOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  if (!origin) return true;
  const host = request.headers.host;
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function providerError(error: unknown): ErrorDescriptor {
  const code: ProviderErrorCode = error instanceof ProviderError ? error.code : "provider-error";
  const descriptors: Partial<Record<ProviderErrorCode, ErrorDescriptor>> = {
    "invalid-repository": {
      status: 400,
      code,
      message: "Use a repository in owner/name format.",
    },
    "repository-unavailable": {
      status: 404,
      code,
      message: "Repository unavailable or private.",
    },
    "authentication-required": {
      status: 401,
      code,
      message: "Provider authentication is unavailable or no longer valid.",
    },
    "permission-denied": {
      status: 403,
      code,
      message: "The configured repository permission does not allow this action.",
    },
    "rate-limited": {
      status: 429,
      code,
      message: "GitHub rate limit reached. Keep the active plugin and try again later.",
    },
    "provider-timeout": {
      status: 504,
      code,
      message: "GitHub did not respond within the bounded read window.",
    },
    "tree-truncated": {
      status: 422,
      code,
      message: "The repository tree is too large to inspect safely.",
    },
    "too-many-files": {
      status: 413,
      code,
      message: "The repository contains more files than this Atlas accepts.",
    },
    "too-many-skills": {
      status: 413,
      code,
      message: "The repository contains more skills than this Atlas accepts.",
    },
    "skill-too-large": {
      status: 413,
      code,
      message: "A skill file is larger than the accepted limit.",
    },
    "aggregate-too-large": {
      status: 413,
      code,
      message: "The skill library is larger than the accepted total limit.",
    },
    "empty-repository": {
      status: 422,
      code,
      message: "No skills/<slug>/SKILL.md files were found.",
    },
    "invalid-skill": {
      status: 422,
      code,
      message: "A skill does not meet the bounded Markdown contract.",
    },
    "stale-source": {
      status: 409,
      code,
      message: "The default branch changed. Refresh the plugin before proposing an edit.",
    },
    "duplicate-branch": {
      status: 409,
      code,
      message: "That proposal branch already exists. Start a new proposal.",
    },
  };
  return (
    descriptors[code] ?? {
      status: 502,
      code,
      message: "GitHub could not complete the bounded request.",
    }
  );
}

function serverSessionState(
  store: SessionStore,
  authenticated: boolean,
  providerAvailable: boolean,
): SessionState {
  return {
    kind: "atlas-session",
    mode: "self-hosted",
    authenticated,
    adminAvailable: store.available,
    providerAvailable,
  };
}

export function createAtlasServer(config: AtlasRuntimeConfig = {}): Server {
  const store = new SessionStore(config.adminPassword);
  const secureCookie = config.secureCookie ?? false;
  const providerAvailable = Boolean(config.githubToken?.trim());

  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = requestUrl(request);
    if (!url) {
      sendError(response, 400, "invalid-request", "The request path is invalid.");
      return;
    }
    const route = url.pathname;
    const token = cookieValue(request.headers.cookie, SESSION_COOKIE);
    const authenticated = store.authenticated(token);

    if (route === "/api/health" && request.method === "GET") {
      const health: AtlasHealth = {
        status: "ok",
        mode: "self-hosted",
        adminConfigured: store.available,
        githubConfigured: providerAvailable,
        sessions: "memory",
      };
      sendJson(response, 200, health);
      return;
    }
    if (route === "/api/session" && request.method === "GET") {
      sendJson(response, 200, serverSessionState(store, authenticated, providerAvailable));
      return;
    }
    if (route === "/api/session/login" && request.method === "POST") {
      if (!sameOrigin(request)) {
        sendError(response, 403, "origin-denied", "This admin request must be same-origin.");
        return;
      }
      let body: unknown;
      try {
        body = await readJson(request);
      } catch (error) {
        const code = error instanceof Error ? error.message : "invalid-json";
        sendError(
          response,
          code === "body-too-large" ? 413 : 400,
          code,
          "The login request is invalid.",
        );
        return;
      }
      const password =
        body && typeof body === "object" ? (body as Record<string, unknown>).password : null;
      if (typeof password !== "string" || password.length > 512) {
        sendError(response, 400, "invalid-login", "The login request is invalid.");
        return;
      }
      const session = store.login(password);
      if (!session) {
        sendError(response, 401, "login-denied", "Admin sign-in was not accepted.");
        return;
      }
      sendJson(response, 200, serverSessionState(store, true, providerAvailable), {
        "set-cookie": sessionCookie(session, secureCookie),
      });
      return;
    }
    if (route === "/api/session" && request.method === "DELETE") {
      if (!sameOrigin(request)) {
        sendError(response, 403, "origin-denied", "This admin request must be same-origin.");
        return;
      }
      store.logout(token);
      sendJson(response, 200, serverSessionState(store, false, providerAvailable), {
        "set-cookie": expiredSessionCookie(secureCookie),
      });
      return;
    }
    if (route === "/api/packs/import" && request.method === "GET") {
      const repository = url.searchParams.get("repository") ?? "";
      try {
        const transport = createGitHubFetchTransport({
          ...(authenticated && config.githubToken ? { token: config.githubToken } : {}),
          ...(config.fetcher ? { fetcher: config.fetcher } : {}),
        });
        const pack = await readGitHubPack(transport, repository);
        sendJson(response, 200, pack);
      } catch (error) {
        const descriptor = providerError(error);
        sendError(response, descriptor.status, descriptor.code, descriptor.message);
      }
      return;
    }
    if (route === "/api/proposals" && request.method === "POST") {
      if (!sameOrigin(request)) {
        sendError(response, 403, "origin-denied", "This provider write must be same-origin.");
        return;
      }
      if (!authenticated) {
        sendError(response, 401, "admin-required", "Admin sign-in is required.");
        return;
      }
      if (!config.githubToken) {
        sendError(
          response,
          503,
          "provider-not-configured",
          "GitHub write access is not configured.",
        );
        return;
      }
      let body: unknown;
      try {
        body = await readJson(request);
      } catch (error) {
        const code = error instanceof Error ? error.message : "invalid-json";
        sendError(
          response,
          code === "body-too-large" ? 413 : 400,
          code,
          "The proposal request is invalid.",
        );
        return;
      }
      const proposal = parseProposalRequest(body);
      if (!proposal) {
        sendError(response, 400, "invalid-proposal", "The proposal request is invalid.");
        return;
      }
      try {
        const transport = createGitHubFetchTransport({
          token: config.githubToken,
          ...(config.fetcher ? { fetcher: config.fetcher } : {}),
        });
        sendJson(response, 201, await proposeGitHubChange(transport, proposal));
      } catch (error) {
        const descriptor = providerError(error);
        sendError(response, descriptor.status, descriptor.code, descriptor.message);
      }
      return;
    }
    if (route === "/api/usage" && request.method === "GET") {
      sendJson(response, 200, { kind: "atlas-usage", connected: false, events: [] });
      return;
    }
    if (route.startsWith("/api/")) {
      sendError(response, 404, "not-found", "That API route is not available.");
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      sendError(response, 405, "method-not-allowed", "That method is not available.");
      return;
    }
    await sendStatic(response, route);
  }

  const server = createServer((request, response) => {
    const started = performance.now();
    const requestId = randomUUID().slice(0, 8);
    const route = requestUrl(request)?.pathname ?? "<invalid>";
    const timer = setTimeout(() => {
      if (!response.headersSent) {
        sendError(response, 504, "request-timeout", "The request took too long.");
      }
      response.destroy();
    }, requestTimeoutMs);
    void handle(request, response)
      .catch(() => {
        if (!response.headersSent) {
          sendError(response, 500, "server-error", "The Atlas could not complete that request.");
        }
      })
      .finally(() => {
        clearTimeout(timer);
        console.log(
          JSON.stringify({
            event: "request",
            requestId,
            route,
            status: response.statusCode || 200,
            outcome: response.statusCode < 400 ? "ok" : "error",
            durationMs: Math.round(performance.now() - started),
          }),
        );
      });
  });
  server.requestTimeout = requestTimeoutMs;
  server.headersTimeout = requestTimeoutMs + 1000;
  return server;
}

export function startAtlasServer(): Server {
  const server = createAtlasServer({
    ...(process.env.ATLAS_ADMIN_PASSWORD
      ? { adminPassword: process.env.ATLAS_ADMIN_PASSWORD }
      : {}),
    ...(process.env.GITHUB_TOKEN ? { githubToken: process.env.GITHUB_TOKEN } : {}),
    secureCookie: process.env.ATLAS_COOKIE_SECURE === "1",
  });
  const port = portFromEnvironment();
  const host = process.env.HOST?.trim() || "127.0.0.1";
  server.listen(port, host, () => {
    console.log(
      JSON.stringify({
        event: "listening",
        port,
        mode: "self-hosted",
        adminConfigured: Boolean(process.env.ATLAS_ADMIN_PASSWORD),
        githubConfigured: Boolean(process.env.GITHUB_TOKEN),
      }),
    );
  });
  return server;
}

const entryPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (entryPath === fileURLToPath(import.meta.url)) startAtlasServer();
