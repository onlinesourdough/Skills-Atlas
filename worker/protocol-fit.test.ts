import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { OAuthProvider, type OAuthHelpers, OAuthError } from "@cloudflare/workers-oauth-provider";
import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { z } from "zod";

// Library fit only: synthetic consent, never imported by a Worker entrypoint.
describe("maintained OAuth / MCP protocol fit in real Worker KV and D1", () => {
  it("proves discovery, PKCE, audience, code replay, refresh, legacy/modern MCP and D1 denial", async () => {
    const origin = "https://fit.atlas.example";
    await env.DB.exec(
      "CREATE TABLE IF NOT EXISTS protocol_fit_guard (id TEXT PRIMARY KEY, active INTEGER NOT NULL)",
    );
    const connection = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO protocol_fit_guard VALUES (?, 1)").bind(connection).run();
    type FitEnv = Env & { OAUTH_PROVIDER?: OAuthHelpers };
    const exchanges: string[] = [];
    const provider = new OAuthProvider<FitEnv>({
      apiRoute: "/mcp",
      authorizeEndpoint: "/authorize",
      tokenEndpoint: "/token",
      clientRegistrationEndpoint: "/register",
      accessTokenTTL: 120,
      refreshTokenTTL: 600,
      clientRegistrationTTL: 600,
      allowPlainPKCE: false,
      clientIdMetadataDocumentEnabled: false,
      scopesSupported: ["atlas:read"],
      resourceMetadata: {
        resource: `${origin}/mcp`,
        authorization_servers: [origin],
        scopes_supported: ["atlas:read"],
      },
      tokenExchangeCallback: async (options) => {
        exchanges.push(options.grantType);
        if (options.requestedScope.join(" ") !== "atlas:read")
          throw new OAuthError("invalid_scope", { description: "Read scope required" });
        return { accessTokenProps: { connection, scope: options.requestedScope } };
      },
      apiHandler: {
        async fetch(request, _env, ctx) {
          const props: unknown = ctx.props;
          expect(props).toEqual({ connection, scope: ["atlas:read"] });
          const current = await env.DB.prepare("SELECT active FROM protocol_fit_guard WHERE id = ?")
            .bind(connection)
            .first<{ active: number }>();
          if (!current?.active) return new Response(null, { status: 401 });
          const handler = createMcpHandler(
            () => {
              const server = new McpServer({ name: "atlas-protocol-fit", version: "1.0.0" });
              server.registerTool(
                "identity",
                { inputSchema: z.object({}), annotations: { readOnlyHint: true } },
                () => ({ content: [{ type: "text", text: "synthetic-user-11" }] }),
              );
              return server;
            },
            { legacy: "stateless", responseMode: "json", maxSubscriptions: 0, keepAliveMs: 0 },
          );
          return handler.fetch(request);
        },
      },
      defaultHandler: {
        async fetch(request, runtime) {
          if (!runtime.OAUTH_PROVIDER) throw new Error("Missing OAuth helpers");
          const auth = await runtime.OAUTH_PROVIDER.parseAuthRequest(request);
          const result = await runtime.OAUTH_PROVIDER.completeAuthorization({
            request: auth,
            userId: "11",
            scope: ["atlas:read"],
            metadata: {},
            props: { connection },
            revokeExistingGrants: false,
          });
          return Response.redirect(result.redirectTo, 302);
        },
      },
    });
    const request = async (path: string, init?: RequestInit) => {
      const ctx = createExecutionContext();
      const response = await provider.fetch(
        new Request(new URL(path, origin), init),
        { ...env },
        ctx,
      );
      await waitOnExecutionContext(ctx);
      return response;
    };
    expect((await request("/mcp")).status).toBe(401);
    const metadata = await (
      await request("/.well-known/oauth-authorization-server")
    ).json<{ issuer: string; code_challenge_methods_supported: string[] }>();
    expect(metadata).toMatchObject({ issuer: origin, code_challenge_methods_supported: ["S256"] });
    expect(await (await request("/.well-known/oauth-protected-resource/mcp")).json()).toMatchObject(
      { resource: `${origin}/mcp` },
    );
    const registration = await request("/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_name: "Synthetic fit client",
        redirect_uris: ["http://127.0.0.1:4199/callback"],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      }),
    });
    expect(registration.status).toBe(201);
    const client = await registration.json<{ client_id: string }>();
    const verifier = "v".repeat(43);
    const digest = new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
    );
    const challenge = btoa(String.fromCharCode(...digest))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replaceAll("=", "");
    const parameters = new URLSearchParams({
      client_id: client.client_id,
      redirect_uri: "http://127.0.0.1:4199/callback",
      response_type: "code",
      scope: "atlas:read",
      state: "synthetic-state",
      code_challenge: challenge,
      code_challenge_method: "S256",
      resource: `${origin}/mcp`,
    });
    const authorize = await request(`/authorize?${parameters}`);
    expect(authorize.status).toBe(302);
    const callback = new URL(authorize.headers.get("location")!);
    expect(callback.searchParams.get("iss")).toBe(origin);
    expect(callback.searchParams.get("state")).toBe("synthetic-state");
    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      code: callback.searchParams.get("code")!,
      client_id: client.client_id,
      code_verifier: verifier,
      resource: `${origin}/mcp`,
      redirect_uri: "http://127.0.0.1:4199/callback",
    });
    const tokenRequest = (body: URLSearchParams) =>
      request("/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
    const wrong = new URLSearchParams(tokenBody);
    wrong.set("code_verifier", "w".repeat(43));
    expect((await tokenRequest(wrong)).status).toBe(400);
    wrong.set("code_verifier", verifier);
    wrong.set("resource", "https://foreign.example/mcp");
    expect((await tokenRequest(wrong)).status).toBe(400);
    const tokenResponse = await tokenRequest(tokenBody);
    expect(tokenResponse.status).toBe(200);
    const tokens = await tokenResponse.json<{ access_token: string; refresh_token: string }>();
    const refreshed = await tokenRequest(
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
        client_id: client.client_id,
        resource: `${origin}/mcp`,
      }),
    );
    expect(refreshed.status).toBe(200);
    const current = await refreshed.json<{ access_token: string }>();
    const transport = new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), {
      authProvider: { token: async () => current.access_token },
      fetch: async (input, init) => request(String(input), init),
    });
    const sdkClient = new Client({ name: "standard-fit-client", version: "1.0.0" });
    try {
      await sdkClient.connect(transport);
      expect((await sdkClient.listTools()).tools.map((tool) => tool.name)).toEqual(["identity"]);
      expect(await sdkClient.callTool({ name: "identity", arguments: {} })).toMatchObject({
        content: [{ text: "synthetic-user-11" }],
      });
      const legacy = await request("/mcp", {
        method: "POST",
        headers: {
          authorization: `Bearer ${current.access_token}`,
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-11-25",
            capabilities: {},
            clientInfo: { name: "legacy-fit", version: "1" },
          },
        }),
      });
      expect(legacy.status).toBe(200);
      expect(await legacy.text()).toContain("2025-11-25");
      await env.DB.prepare("UPDATE protocol_fit_guard SET active = 0 WHERE id = ?")
        .bind(connection)
        .run();
      expect(
        (await request("/mcp", { headers: { authorization: `Bearer ${current.access_token}` } }))
          .status,
      ).toBe(401);
      expect((await tokenRequest(tokenBody)).status).toBe(400);
      expect(exchanges).toEqual(["authorization_code", "refresh_token"]);
    } finally {
      await sdkClient.close();
    }
  });
});
