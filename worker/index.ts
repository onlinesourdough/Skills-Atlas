import { ProviderError } from "../src/domain/github.js";
import { isRepositoryName } from "../src/domain/contracts.js";
import {
  AtlasError,
  cookie,
  deploymentPolicy,
  requestJson,
  requireOrigin,
  callbackFormSource,
  type DeploymentPolicy,
} from "./security.js";
import { GitHubIdentity } from "./github.js";
import { AtlasService } from "./service.js";
import { ProfileStore } from "./store.js";
import { AgentAccess } from "./agents.js";
import { authErrorDocument } from "./auth-document.js";
import { AuthorizationError, OAuthError } from "@cloudflare/workers-oauth-provider";

const securityHeaders = {
  "cache-control": "no-store, private",
  "content-security-policy":
    "default-src 'self'; connect-src 'self' https://api.github.com; font-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self' https://github.com",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

function secureResponse(response: Response, document = false, consentCallback?: string): Response {
  const result = new Response(response.body, response);
  for (const [key, value] of Object.entries(securityHeaders)) result.headers.set(key, value);
  // Native POST forms need a non-null Origin. Documents disclose only an origin,
  // never a private path/query; OAuth/API responses retain no-referrer.
  if (document) result.headers.set("referrer-policy", "strict-origin");
  if (document && consentCallback) {
    result.headers.set(
      "content-security-policy",
      `${securityHeaders["content-security-policy"]} ${callbackFormSource(consentCallback)}`,
    );
  }
  return result;
}

function safeError(error: unknown): AtlasError {
  if (error instanceof AtlasError) return error;
  if (error instanceof ProviderError) {
    if (error.code === "authentication-required") return new AtlasError("session-expired", 401);
    if (error.code === "repository-unavailable" || error.code === "permission-denied")
      return new AtlasError("source-unavailable", 404);
    return new AtlasError(error.code, error.code === "rate-limited" ? 429 : 422);
  }
  return new AtlasError("service-unavailable", 503);
}

/** Dependency injection is only used by local tests; deployment config cannot select a provider. */
export async function handleRequest(
  request: Request,
  env: Env,
  options: { fetcher?: typeof fetch; now?: () => number; ctx?: ExecutionContext } = {},
): Promise<Response> {
  const url = new URL(request.url);
  let policy: DeploymentPolicy | undefined;
  try {
    const agentRoute =
      url.pathname === "/mcp" ||
      url.pathname.startsWith("/agent/") ||
      url.pathname.startsWith("/.well-known/");
    if (!agentRoute && !url.pathname.startsWith("/api/") && !url.pathname.startsWith("/auth/")) {
      if (!["GET", "HEAD"].includes(request.method))
        throw new AtlasError("method-not-allowed", 405);
      const response = await env.ASSETS.fetch(request);
      return secureResponse(
        response,
        response.headers.get("content-type")?.startsWith("text/html"),
      );
    }
    policy = await deploymentPolicy(env);
    requireOrigin(request, policy, !agentRoute && !["GET", "HEAD"].includes(request.method));
    const service = new AtlasService(
      policy,
      new ProfileStore(env.DB),
      new GitHubIdentity(options.fetcher),
      options.now,
    );
    const agents = new AgentAccess(env, service);
    if (agentRoute) {
      if (!options.ctx) throw new AtlasError("service-unavailable", 503);
      const response = await agents.fetch(request, options.ctx);
      return secureResponse(
        response,
        response.headers.get("content-type")?.startsWith("text/html"),
        agents.consentCallback,
      );
    }
    if (url.pathname === "/api/health" && request.method === "GET") {
      await env.DB.prepare("SELECT user_id FROM profiles LIMIT 1").first();
      await env.DB.prepare("SELECT id FROM credentials LIMIT 1").first();
      await env.OAUTH_KV.get("atlas-health");
      return secureResponse(
        Response.json({
          status: "ok",
          mode: policy.deployment,
          sessions: "d1",
          provider: "github-app",
          writes: false,
          agentTokens: "oauth-kv-with-d1-revocation",
        }),
      );
    }
    if (url.pathname === "/auth/github/login" && request.method === "POST")
      return secureResponse(await service.login(request));
    if (url.pathname === "/auth/github/callback" && request.method === "GET")
      return secureResponse(await service.callback(request));
    if (url.pathname === "/api/session" && request.method === "DELETE")
      return secureResponse(await service.logout(request));
    if (url.pathname === "/api/signout-everywhere" && request.method === "POST")
      return secureResponse(await service.logout(request, true));
    if (url.pathname === "/api/session/login") throw new AtlasError("legacy-auth-retired", 410);
    if (url.pathname === "/api/proposals") throw new AtlasError("read-only", 403);
    if (
      url.pathname === "/api/session" &&
      request.method === "GET" &&
      !request.headers.has("cookie")
    ) {
      return secureResponse(
        Response.json({
          kind: "atlas-login",
          configured: true,
          deployment: policy.deployment,
          organization: policy.organization,
          loginPath: "/auth/github/login",
        }),
      );
    }
    const connectionId = /^\/api\/connections\/([a-f0-9-]{36})$/u.exec(url.pathname)?.[1];
    if (connectionId && request.method === "DELETE") {
      await agents.disconnect(await service.revocationUser(request), connectionId);
      return secureResponse(Response.json({ disconnected: true }));
    }
    const principal = await service.principal(request);
    if (url.pathname === "/api/connections" && request.method === "GET")
      return secureResponse(Response.json(await agents.list(principal)));
    if (["/api/profile", "/api/session"].includes(url.pathname) && request.method === "GET")
      return secureResponse(Response.json(await service.profile(principal)));
    if (url.pathname === "/api/usage" && request.method === "GET")
      return secureResponse(Response.json({ kind: "atlas-usage", connected: false, events: [] }));
    if (
      ["/api/sources", "/api/sources/preview"].includes(url.pathname) &&
      request.method === "POST"
    ) {
      await service.csrf(request, principal);
      const body = await requestJson(request);
      if (
        Object.keys(body).some((key) => !["repository", "expected"].includes(key)) ||
        typeof body.repository !== "string" ||
        !isRepositoryName(body.repository)
      )
        throw new AtlasError("invalid-repository");
      if (url.pathname === "/api/sources/preview") {
        if (body.expected !== undefined) throw new AtlasError("invalid-request");
        return secureResponse(
          Response.json(await service.previewSource(principal, body.repository)),
        );
      }
      let expected: { repositoryId: number; revision: string } | undefined;
      if (body.expected !== undefined) {
        const value = body.expected as Record<string, unknown> | null;
        if (
          !value ||
          typeof value !== "object" ||
          Array.isArray(value) ||
          Object.keys(value).length !== 2 ||
          !Number.isSafeInteger(value.repositoryId) ||
          Number(value.repositoryId) <= 0 ||
          typeof value.revision !== "string" ||
          !/^[a-f0-9]{40}$/u.test(value.revision)
        )
          throw new AtlasError("invalid-request");
        expected = { repositoryId: Number(value.repositoryId), revision: value.revision };
      }
      return secureResponse(
        Response.json(await service.importSource(principal, body.repository, expected)),
      );
    }
    const sourceId = /^\/api\/sources\/([a-f0-9-]{36})$/u.exec(url.pathname)?.[1];
    if (sourceId) {
      if (request.method === "GET")
        return secureResponse(Response.json(await service.readSource(principal, sourceId)));
      await service.csrf(request, principal);
      if (request.method === "PATCH") {
        const body = await requestJson(request);
        if (Object.keys(body).length !== 1 || typeof body.visible !== "boolean")
          throw new AtlasError("invalid-request");
        await service.visibility(principal, sourceId, body.visible);
        return secureResponse(Response.json({ kind: "atlas-preference", saved: true }));
      }
      if (request.method === "DELETE") {
        await service.store.removeSource(principal.session, sourceId, service.now());
        return secureResponse(Response.json({ kind: "atlas-preference", removed: true }));
      }
    }
    throw new AtlasError("not-found", 404);
  } catch (error) {
    if (
      url.pathname === "/agent/authorize" &&
      request.headers.get("accept")?.includes("text/html")
    ) {
      const status =
        error instanceof OAuthError
          ? error.statusCode
          : error instanceof AtlasError
            ? error.status
            : 400;
      return secureResponse(
        new Response(authErrorDocument(), {
          status,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
        true,
      );
    }
    if (error instanceof AuthorizationError || error instanceof OAuthError)
      return secureResponse(
        Response.json(
          { error: error.code },
          { status: error instanceof OAuthError ? error.statusCode : 400 },
        ),
      );
    const failure = safeError(error);
    if (url.pathname === "/auth/github/callback" && policy && url.origin === policy.origin) {
      const location = new URL(policy.origin);
      location.searchParams.set("authError", failure.code);
      const headers = new Headers({ location: location.href });
      headers.append("set-cookie", cookie(policy, "oauth", "", 0));
      headers.append("set-cookie", cookie(policy, "session", "", 0));
      return secureResponse(new Response(null, { status: 303, headers }));
    }
    return secureResponse(
      Response.json(
        { error: { code: failure.code } },
        {
          status: failure.status,
          ...(url.pathname === "/mcp" && failure.status === 401 && policy
            ? {
                headers: {
                  "www-authenticate": `Bearer resource_metadata="${policy.origin}/.well-known/oauth-protected-resource/mcp"`,
                },
              }
            : {}),
        },
      ),
    );
  }
}

export default {
  async fetch(request, env, ctx) {
    const started = performance.now();
    const response = await handleRequest(request, env, { ctx });
    // Never log request URLs: OAuth callbacks contain codes, and source paths are private.
    console.log(
      JSON.stringify({
        event: "atlas-request",
        status: response.status,
        durationMs: Math.round(performance.now() - started),
      }),
    );
    return response;
  },
} satisfies ExportedHandler<Env>;
