import {
  OAuthProvider,
  OAuthError,
  type OAuthHelpers,
  type AuthRequest,
} from "@cloudflare/workers-oauth-provider";
import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  AtlasError,
  unseal,
  randomSecret,
  equalSecret,
  boundedText,
  hash,
  MAX_SOURCES,
  callbackFormSource,
} from "./security.js";
import type { AtlasService, ReadPrincipal, Principal } from "./service.js";
import { authDocument, escapeHtml } from "./auth-document.js";

export const READ_SCOPE = "atlas:read";
type AgentEnv = Env & { OAUTH_PROVIDER?: OAuthHelpers };
interface Connection {
  id: string;
  user_id: number;
  credential_id: string;
  client_id: string;
  client_name: string;
  grant_id: string | null;
  policy_key: string;
  expires_at: number;
  token_ciphertext: string;
  created_at: number;
  login: string;
}

const invalidGrant = () =>
  new OAuthError("invalid_grant", { description: "Connection unavailable" });

export class AgentAccess {
  // Set only after the OAuth library validates this document's client and redirect.
  consentCallback: string | undefined;
  constructor(
    readonly env: Env,
    readonly service: AtlasService,
  ) {}

  async connection(id: string): Promise<Connection> {
    const row = await this.env.DB.prepare(
      `SELECT a.*, c.token_ciphertext, p.login FROM agent_connections a
      JOIN credentials c ON c.id = a.credential_id AND c.user_id = a.user_id AND c.policy_key = a.policy_key
      JOIN profiles p ON p.user_id = a.user_id
      WHERE a.id = ? AND a.policy_key = ? AND a.expires_at > ? AND c.expires_at >= a.expires_at`,
    )
      .bind(id, this.service.policy.key, this.service.now())
      .first<Connection>();
    if (!row) throw new AtlasError("connection-unavailable", 401);
    return row;
  }

  async principal(id: string, accessExpiresAt?: number): Promise<ReadPrincipal> {
    const row = await this.connection(id);
    const expiresAt = Math.min(row.expires_at, accessExpiresAt ?? row.expires_at);
    const checkedAt = this.service.now();
    try {
      const token = await unseal(
        row.token_ciphertext,
        this.service.policy.encryptionKey,
        `${this.service.policy.key}:credential:${row.credential_id}:${row.user_id}`,
      );
      const user = await this.service.github.authorize(this.service.policy, token, row.user_id);
      const assertCurrent = async () => {
        const current = await this.connection(id);
        if (
          current.credential_id !== row.credential_id ||
          expiresAt <= this.service.now() ||
          checkedAt + 300_000 <= this.service.now()
        )
          throw new AtlasError("connection-unavailable", 401);
      };
      await assertCurrent();
      return {
        userId: row.user_id,
        login: user.login,
        token,
        expiresAt,
        checkedAt,
        assertCurrent,
      };
    } catch (error) {
      if (
        error instanceof AtlasError &&
        ["session-expired", "access-denied", "membership-pending"].includes(error.code)
      )
        await this.service.store.revokeUser(row.user_id);
      throw error;
    }
  }

  async list(principal: Principal) {
    const rows = await this.env.DB.prepare(
      "SELECT id, client_name AS clientName, expires_at AS expiresAt FROM agent_connections WHERE user_id = ? AND policy_key = ? AND expires_at > ? ORDER BY created_at LIMIT 20",
    )
      .bind(principal.userId, this.service.policy.key, this.service.now())
      .all();
    await principal.assertCurrent();
    return {
      endpoint: `${this.service.policy.origin}/mcp`,
      scope: READ_SCOPE,
      connections: rows.results,
    };
  }

  async disconnect(userId: number, id: string) {
    await this.env.DB.prepare("DELETE FROM agent_connections WHERE id = ? AND user_id = ?")
      .bind(id, userId)
      .run();
  }

  private link(principal: ReadPrincipal, source: string, skill: string) {
    const url = new URL(this.service.policy.origin);
    url.search = new URLSearchParams({
      account: String(principal.userId),
      source,
      skill,
    }).toString();
    url.hash = "library";
    return url.href;
  }

  private mcp(principal: ReadPrincipal) {
    const server = new McpServer({ name: "skills-atlas", version: "1.0.0" });
    const register = <T extends z.ZodRawShape>(
      name: string,
      description: string,
      schema: T,
      run: (input: z.infer<z.ZodObject<T>>) => Promise<unknown>,
    ) => {
      server.registerTool(
        name,
        {
          description,
          inputSchema: z.object(schema).strict(),
          annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
        },
        async (input) => {
          try {
            const result = await run(input as z.infer<z.ZodObject<T>>);
            await principal.assertCurrent();
            const text = JSON.stringify(result);
            if (new TextEncoder().encode(text).byteLength > 262144)
              throw new AtlasError("response-limit", 422);
            return { content: [{ type: "text" as const, text }] };
          } catch (error) {
            return {
              isError: true,
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    error: error instanceof AtlasError ? error.code : "read-unavailable",
                  }),
                },
              ],
            };
          }
        },
      );
    };
    register(
      "connection_identity",
      "Current Atlas installation, GitHub account and read scope.",
      {},
      async () => ({
        installation: this.service.policy.origin,
        user: { id: principal.userId, login: principal.login },
        scope: READ_SCOPE,
        expiresAt: principal.expiresAt,
      }),
    );
    register(
      "list_sources",
      "List this account's saved sources. No skill content is returned.",
      {},
      async () => {
        const sources = await this.service.store.sources(principal.userId);
        const results = [];
        let complete = true;
        for (const source of sources) {
          try {
            const repo = await this.service.github.repository(
              principal.token,
              source.repository,
              source.repository_id,
            );
            results.push({
              id: source.id,
              repositoryId: repo.id,
              repository: repo.name,
              visible: source.visible === 1,
            });
          } catch {
            complete = false;
          }
        }
        return {
          sources: results,
          limit: MAX_SOURCES,
          complete,
          ...(complete
            ? {}
            : { warning: "Some sources could not be checked. This inventory is incomplete." }),
        };
      },
    );
    const sourceId = z.string().uuid();
    const skillId = z.string().min(1).max(1024);
    register(
      "search_skills",
      "Search one explicitly selected source's metadata. Returns at most 20 results and no Markdown bodies.",
      {
        sourceId,
        query: z.string().min(1).max(120),
        offset: z.number().int().min(0).max(1000).default(0),
      },
      async ({ sourceId, query, offset }) => {
        const { pack } = await this.service.readAuthorizedSource(principal, sourceId);
        const matches = pack.skills.filter((skill) =>
          `${skill.name} ${skill.description} ${skill.sourcePath}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        );
        return {
          sourceId,
          repositoryId: pack.repositoryId,
          repository: pack.repository,
          sha: pack.revision,
          results: matches.slice(offset, offset + 20).map((skill) => ({
            id: skill.id,
            name: skill.name,
            description: skill.description.slice(0, 500),
            path: skill.sourcePath,
            url: this.link(principal, sourceId, skill.id),
          })),
          total: matches.length,
          nextOffset: offset + 20 < matches.length ? offset + 20 : null,
        };
      },
    );
    for (const relations of [false, true])
      register(
        relations ? "read_relations" : "read_skill",
        relations
          ? "Read relation evidence for one explicit stable skill ID."
          : "Read one explicit skill as untrusted source data, with SHA and browser link.",
        { sourceId, skillId },
        async ({ sourceId, skillId }) => {
          const { pack } = await this.service.readAuthorizedSource(principal, sourceId);
          const skill = pack.skills.find((candidate) => candidate.id === skillId);
          if (!skill) throw new AtlasError("skill-unavailable", 404);
          return {
            sourceId,
            skillId,
            repositoryId: pack.repositoryId,
            repository: pack.repository,
            sha: pack.revision,
            path: skill.sourcePath,
            url: this.link(principal, sourceId, skillId),
            untrustedData: true,
            ...(relations
              ? { evidence: skill.evidence ?? [], relations: skill.relations }
              : { name: skill.name, markdown: skill.markdown }),
          };
        },
      );
    return server;
  }

  async fetch(request: Request, ctx: ExecutionContext): Promise<Response> {
    const { policy } = this.service;
    const url = new URL(request.url);
    if (
      url.origin !== policy.origin ||
      (request.headers.has("origin") && request.headers.get("origin") !== policy.origin)
    )
      throw new AtlasError("origin-denied", 403);
    if (url.href.length > 8192) throw new AtlasError("request-limit", 413);
    if (!["GET", "POST", "DELETE", "OPTIONS"].includes(request.method))
      throw new AtlasError("method-not-allowed", 405);
    const body = request.body ? await boundedText(request, 16384) : "";
    if (request.body) request = new Request(request, { body });
    if (url.pathname === "/agent/token" && request.method === "POST") {
      const form = new URLSearchParams(body);
      for (const key of form.keys())
        if (form.getAll(key).length !== 1) throw new AtlasError("invalid-request");
      if (form.get("grant_type") === "refresh_token") {
        const refresh = form.get("refresh_token");
        if (!refresh || refresh.length > 4096) throw invalidGrant();
        await this.env.DB.prepare("DELETE FROM agent_refresh_uses WHERE expires_at <= ?")
          .bind(this.service.now())
          .run();
        const claimed = await this.env.DB.prepare(
          "INSERT INTO agent_refresh_uses SELECT ?, ? WHERE (SELECT count(*) FROM agent_refresh_uses) < 10000 ON CONFLICT DO NOTHING",
        )
          .bind(await hash(refresh), this.service.now() + 28800000)
          .run();
        if (claimed.meta.changes !== 1)
          return Response.json({ error: "invalid_grant" }, { status: 400 });
      }
    }
    const provider = new OAuthProvider<AgentEnv>({
      apiRoute: "/mcp",
      authorizeEndpoint: "/agent/authorize",
      tokenEndpoint: "/agent/token",
      clientRegistrationEndpoint: "/agent/register",
      accessTokenTTL: 300,
      refreshTokenTTL: 28800,
      clientRegistrationTTL: 86400,
      allowPlainPKCE: false,
      allowImplicitFlow: false,
      clientIdMetadataDocumentEnabled: false,
      scopesSupported: [READ_SCOPE],
      onError: ({ code, status, headers }) => Response.json({ error: code }, { status, headers }),
      resourceMetadata: {
        resource: `${policy.origin}/mcp`,
        scopes_supported: [READ_SCOPE],
      },
      clientRegistrationCallback: async ({ clientMetadata: m }) => {
        const allowed = [
          "client_name",
          "redirect_uris",
          "token_endpoint_auth_method",
          "grant_types",
          "response_types",
          "scope",
        ];
        if (
          Object.keys(m).some((key) => !allowed.includes(key)) ||
          m.token_endpoint_auth_method !== "none" ||
          typeof m.client_name !== "string" ||
          !/^[\p{L}\p{N} ._()-]{1,80}$/u.test(m.client_name) ||
          (m.scope !== undefined && m.scope !== READ_SCOPE) ||
          !Array.isArray(m.grant_types) ||
          m.grant_types.length !== 2 ||
          !m.grant_types.includes("authorization_code") ||
          !m.grant_types.includes("refresh_token") ||
          !Array.isArray(m.response_types) ||
          m.response_types.length !== 1 ||
          m.response_types[0] !== "code" ||
          !Array.isArray(m.redirect_uris) ||
          m.redirect_uris.length < 1 ||
          m.redirect_uris.length > 5 ||
          m.redirect_uris.some((uri) => {
            try {
              callbackFormSource(uri);
              return false;
            } catch {
              return true;
            }
          })
        )
          return { code: "invalid_client_metadata", description: "Unsupported client metadata" };
        const bucket = Math.floor(this.service.now() / 3600000);
        await this.env.DB.prepare("DELETE FROM agent_registration_limits WHERE bucket < ?")
          .bind(bucket)
          .run();
        const result = await this.env.DB.prepare(
          "INSERT INTO agent_registration_limits VALUES (?, 1) ON CONFLICT(bucket) DO UPDATE SET count = count + 1 WHERE count < 100 RETURNING count",
        )
          .bind(bucket)
          .first();
        if (!result) return { code: "access_denied", description: "Registration capacity reached" };
      },
      tokenExchangeCallback: async (options) => {
        if (options.requestedScope.join(" ") !== READ_SCOPE)
          throw new OAuthError("invalid_scope", { description: "Read scope required" });
        const id = typeof options.props?.connection === "string" ? options.props.connection : "";
        try {
          const row = await this.connection(id);
          if (String(row.user_id) !== options.userId || row.client_id !== options.clientId)
            throw invalidGrant();
          await this.principal(id);
          if (options.grantType === "authorization_code") {
            if (row.created_at + 600000 <= this.service.now()) throw invalidGrant();
            const claimed = await this.env.DB.prepare(
              "UPDATE agent_connections SET grant_id = ? WHERE id = ? AND grant_id IS NULL AND expires_at > ?",
            )
              .bind(options.grantId, id, this.service.now())
              .run();
            if (claimed.meta.changes !== 1) throw invalidGrant();
          } else if (options.grantType !== "refresh_token" || row.grant_id !== options.grantId)
            throw invalidGrant();
          const remaining = Math.floor((row.expires_at - this.service.now()) / 1000);
          if (remaining < 60) throw invalidGrant();
          return {
            accessTokenProps: {
              connection: id,
              scope: READ_SCOPE,
              expiresAt: this.service.now() + Math.min(300, remaining) * 1000,
            },
            accessTokenTTL: Math.min(300, remaining),
            ...(options.grantType === "authorization_code" ? { refreshTokenTTL: remaining } : {}),
          };
        } catch {
          throw invalidGrant();
        }
      },
      apiHandler: {
        fetch: async (req, _runtime, context) => {
          const props = context.props as
            | { scope?: unknown; connection?: unknown; expiresAt?: unknown }
            | undefined;
          if (
            props?.scope !== READ_SCOPE ||
            typeof props?.connection !== "string" ||
            typeof props.expiresAt !== "number" ||
            props.expiresAt <= this.service.now()
          )
            throw new AtlasError("connection-unavailable", 401);
          const principal = await this.principal(props.connection, props.expiresAt);
          if (req.method !== "POST")
            return new Response(null, { status: 405, headers: { allow: "POST" } });
          let message: unknown;
          try {
            message = JSON.parse(body);
          } catch {
            throw new AtlasError("invalid-request", 400);
          }
          if (!message || typeof message !== "object" || Array.isArray(message))
            throw new AtlasError("invalid-request", 400);
          const method = "method" in message ? message.method : undefined;
          if (
            typeof method !== "string" ||
            ![
              "initialize",
              "ping",
              "tools/list",
              "tools/call",
              "notifications/initialized",
              "notifications/cancelled",
            ].includes(method)
          ) {
            const id =
              "id" in message && (typeof message.id === "string" || typeof message.id === "number")
                ? message.id
                : null;
            return Response.json(
              { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not available" } },
              { status: 400 },
            );
          }
          const response = await createMcpHandler(() => this.mcp(principal), {
            legacy: "stateless",
            responseMode: "json",
            maxSubscriptions: 0,
            keepAliveMs: 0,
          }).fetch(req);
          // Materialize before the final guard: revoked in-flight content cannot escape.
          const responseBody = await boundedText(response, 300000);
          await principal.assertCurrent();
          return new Response(responseBody, response);
        },
      },
      defaultHandler: { fetch: async (req, runtime) => this.consent(req, runtime.OAUTH_PROVIDER!) },
    });
    return provider.fetch(request, { ...this.env }, ctx);
  }

  private async consent(request: Request, oauth: OAuthHelpers): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/agent/authorize") throw new AtlasError("not-found", 404);
    let principal: Principal;
    try {
      principal = await this.service.principal(request);
    } catch (error) {
      if (
        request.method !== "GET" ||
        !(error instanceof AtlasError) ||
        !["login-required", "session-expired"].includes(error.code)
      )
        throw error;
      callbackFormSource((await oauth.parseAuthRequest(request)).redirectUri);
      return new Response(
        authDocument(
          "Sign in",
          `<h1>Sign in to connect your agent</h1><p>Use your GitHub account for this Atlas. You will review the client and read scope before approving a connection.</p><form method="post" action="/auth/github/login"><input type="hidden" name="returnTo" value="${escapeHtml(`${url.pathname}${url.search}`)}"><button>Sign in with GitHub</button></form>`,
        ),
        { headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }
    if (request.method === "GET") {
      for (const key of url.searchParams.keys())
        if (url.searchParams.getAll(key).length !== 1) throw new AtlasError("invalid-request");
      const auth = await oauth.parseAuthRequest(request);
      callbackFormSource(auth.redirectUri);
      if (
        auth.scope.join(" ") !== READ_SCOPE ||
        auth.codeChallengeMethod !== "S256" ||
        !/^[A-Za-z0-9_-]{43}$/u.test(auth.codeChallenge ?? "") ||
        !auth.state ||
        auth.state.length > 512
      )
        throw new AtlasError("invalid-request");
      const client = await oauth.lookupClient(auth.clientId);
      if (!client || client.clientSecret) throw new AtlasError("invalid-request");
      const id = randomSecret();
      const inserted = await this.env.DB.batch([
        this.env.DB.prepare(
          "DELETE FROM agent_consents WHERE expires_at <= ? OR session_hash = ?",
        ).bind(this.service.now(), principal.session.session_hash),
        this.env.DB.prepare(
          "INSERT INTO agent_consents SELECT ?, ?, ?, ? WHERE (SELECT count(*) FROM agent_consents) < 1000",
        ).bind(
          id,
          principal.session.session_hash,
          JSON.stringify(auth),
          this.service.now() + 300000,
        ),
      ]);
      if (inserted[1]?.meta.changes !== 1) throw new AtlasError("consent-limit", 429);
      this.consentCallback = auth.redirectUri;
      const html = authDocument(
        "Connect your agent",
        `<h1>Connect your agent</h1><dl><dt>Installation</dt><dd>${escapeHtml(this.service.policy.origin)}</dd><dt>Client</dt><dd>${escapeHtml(client.clientName ?? "Unnamed client")}<br><code>${escapeHtml(client.clientId)}</code></dd><dt>GitHub</dt><dd>${escapeHtml(principal.login)} — numeric account ${principal.userId}</dd><dt>Scope</dt><dd><code>${READ_SCOPE}</code></dd></dl><p>Read sources, search, and read explicitly requested skills and relations. Requested content goes to your chosen agent and model environment.</p><p>Browser logout leaves this connection active until expiry. Disconnect the agent or sign out everywhere to revoke it.</p><form method="post" action="/agent/authorize"><input type="hidden" name="consent" value="${id}"><input type="hidden" name="csrf" value="${principal.session.csrf_token}"><button name="decision" value="approve">Approve read access</button><button name="decision" value="cancel">Cancel</button></form>`,
      );
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    if (request.method !== "POST" || request.headers.get("origin") !== this.service.policy.origin)
      throw new AtlasError("origin-denied", 403);
    const form = new URLSearchParams(await boundedText(request, 16384));
    if (
      [...form.keys()].some(
        (key) => !["consent", "csrf", "decision"].includes(key) || form.getAll(key).length !== 1,
      ) ||
      !(await equalSecret(form.get("csrf") ?? "", principal.session.csrf_token))
    )
      throw new AtlasError("csrf-denied", 403);
    const pending = await this.env.DB.prepare(
      "DELETE FROM agent_consents WHERE id = ? AND session_hash = ? AND expires_at > ? RETURNING request_json",
    )
      .bind(form.get("consent") ?? "", principal.session.session_hash, this.service.now())
      .first<{ request_json: string }>();
    if (!pending) throw new AtlasError("consent-expired", 400);
    const auth: AuthRequest = JSON.parse(pending.request_json);
    const client = await oauth.lookupClient(auth.clientId);
    if (!client) throw new AtlasError("consent-expired", 400);
    callbackFormSource(auth.redirectUri);
    if (form.get("decision") === "cancel") {
      if (!client.redirectUris.includes(auth.redirectUri)) throw new AtlasError("invalid-request");
      const target = new URL(auth.redirectUri);
      target.searchParams.set("error", "access_denied");
      target.searchParams.set("state", auth.state);
      target.searchParams.set("iss", this.service.policy.origin);
      return Response.redirect(target.href, 303);
    }
    if (form.get("decision") !== "approve") throw new AtlasError("invalid-request");
    const id = crypto.randomUUID();
    const inserted = await this.env.DB.prepare(
      `INSERT INTO agent_connections (id, user_id, credential_id, client_id, client_name, policy_key, expires_at, created_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM sessions WHERE session_hash = ? AND expires_at > ?) AND (SELECT count(*) FROM agent_connections WHERE user_id = ?) < 20`,
    )
      .bind(
        id,
        principal.userId,
        principal.session.credential_id,
        auth.clientId,
        client.clientName ?? "Agent",
        this.service.policy.key,
        principal.expiresAt,
        this.service.now(),
        principal.session.session_hash,
        this.service.now(),
        principal.userId,
      )
      .run();
    if (inserted.meta.changes !== 1) throw new AtlasError("connection-limit", 409);
    try {
      const result = await oauth.completeAuthorization({
        request: auth,
        userId: String(principal.userId),
        scope: [READ_SCOPE],
        metadata: {},
        props: { connection: id },
        revokeExistingGrants: false,
      });
      await principal.assertCurrent();
      return Response.redirect(result.redirectTo, 303);
    } catch (error) {
      await this.disconnect(principal.userId, id);
      throw error;
    }
  }
}
