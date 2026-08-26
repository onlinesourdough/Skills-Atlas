import { createReadStream } from "node:fs";
import { lstat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { extname, relative, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { AtlasHealth, AtlasSnapshot } from "../src/types.js";
import { loadAtlasSnapshot } from "./source.js";

const clientRoot = fileURLToPath(new URL("../client", import.meta.url));
const defaultPort = 4173;
const requestTimeoutMs = 4000;
const securityHeaders = {
  "content-security-policy":
    "default-src 'self'; connect-src 'self'; font-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
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

function portFromEnvironment(): number {
  const candidate = Number.parseInt(process.env.PORT ?? "", 10);
  return Number.isInteger(candidate) && candidate >= 1024 && candidate <= 65535
    ? candidate
    : defaultPort;
}

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    ...securityHeaders,
  });
  response.end(body);
}

function sendError(response: ServerResponse, status: number, code: string, message: string): void {
  sendJson(response, status, { error: { code, message } });
}

function safeRoute(request: IncomingMessage): string | null {
  try {
    return new URL(request.url ?? "/", "http://atlas.local").pathname;
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

  const type = contentTypes[extname(candidate)] ?? "application/octet-stream";
  response.writeHead(200, {
    "cache-control": "no-cache",
    "content-type": type,
    "content-length": info.size,
    ...securityHeaders,
  });
  createReadStream(candidate).pipe(response);
}

function snapshotHealth(snapshot: AtlasSnapshot): AtlasHealth {
  return {
    status: "ok",
    source: snapshot.source,
    skills: snapshot.skills.length,
    fallback: snapshot.source === "bundled" && Boolean(snapshot.warning),
  };
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const route = safeRoute(request);
  if (!route) {
    sendError(response, 400, "invalid-request", "The request path is invalid.");
    return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    sendError(
      response,
      405,
      "method-not-allowed",
      "This read-only surface accepts GET requests only.",
    );
    return;
  }

  if (route === "/api/skills" || route === "/api/health") {
    const snapshot = await loadAtlasSnapshot(process.env.SKILLS_REPO_PATH);
    if (route === "/api/health") {
      sendJson(response, 200, snapshotHealth(snapshot));
    } else {
      sendJson(response, 200, snapshot);
    }
    return;
  }
  if (route.startsWith("/api/")) {
    sendError(response, 404, "not-found", "That API route is not available.");
    return;
  }
  await sendStatic(response, route);
}

const server = createServer((request, response) => {
  const started = performance.now();
  const requestId = randomUUID().slice(0, 8);
  const route = safeRoute(request) ?? "<invalid>";
  const timer = setTimeout(() => {
    if (!response.headersSent)
      sendError(response, 504, "request-timeout", "The request took too long.");
    response.destroy();
  }, requestTimeoutMs);

  void handle(request, response)
    .catch(() => {
      if (!response.headersSent)
        sendError(response, 500, "server-error", "The Atlas could not complete that read.");
    })
    .finally(() => {
      clearTimeout(timer);
      console.log(
        JSON.stringify({
          event: "request",
          requestId,
          route,
          status: response.statusCode || 200,
          durationMs: Math.round(performance.now() - started),
        }),
      );
    });
});

server.requestTimeout = requestTimeoutMs;
server.headersTimeout = requestTimeoutMs + 1000;

const port = portFromEnvironment();
const host = process.env.HOST?.trim() || "127.0.0.1";
server.listen(port, host, () => {
  console.log(
    JSON.stringify({
      event: "listening",
      port,
      source: process.env.SKILLS_REPO_PATH ? "configured" : "bundled",
    }),
  );
});
