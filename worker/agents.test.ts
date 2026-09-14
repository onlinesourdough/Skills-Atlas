import {
  applyD1Migrations,
  env,
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import migration from "../migrations/0001_personal_profiles.sql?raw";
import agentsMigration from "../migrations/0002_agent_credentials.sql?raw";
import { githubFixture, type FixtureUser } from "../scripts/fixtures/github.js";
import { handleRequest } from "./index.js";
import { MAX_SOURCES } from "./security.js";

const origin = "https://agent.atlas.example";
beforeEach(async () => {
  await applyD1Migrations(
    env.DB,
    [migration, agentsMigration].map((sql, index) => ({
      name: `agent-test-${index}`,
      queries: sql
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean),
    })),
  );
  await env.DB.batch(
    [
      "agent_consents",
      "agent_connections",
      "agent_refresh_uses",
      "agent_registration_limits",
      "sessions",
      "credentials",
      "oauth_attempts",
      "sources",
      "profiles",
    ].map((table) => env.DB.prepare(`DELETE FROM ${table}`)),
  );
});

function harness() {
  const github = githubFixture();
  let now = Date.now();
  const runtime = {
    ...env,
    ATLAS_ORIGIN: origin,
    ATLAS_DEPLOYMENT: "hosted",
    ATLAS_LOCAL_HTTP: "false",
    ATLAS_ALLOWED_ORG: "onlinesourdough",
    ATLAS_ALLOWED_USER_IDS: "",
    ATLAS_DEFAULT_REPOSITORY: "onlinesourdough/Global-Skills",
    GITHUB_CLIENT_ID: "fixture-client-id",
    GITHUB_CLIENT_SECRET: "fixture-client-secret",
    ATLAS_ENCRYPTION_KEY: btoa("0123456789abcdef0123456789abcdef"),
  };
  const request = async (path: string, init: RequestInit = {}) => {
    const ctx = createExecutionContext();
    const response = await handleRequest(new Request(new URL(path, origin), init), runtime, {
      ctx,
      fetcher: github.fetcher,
      now: () => now,
    });
    await waitOnExecutionContext(ctx);
    return response;
  };
  const login = async (user: FixtureUser = "alice") => {
    const begin = await request("/auth/github/login", { method: "POST", headers: { origin } });
    const browser = begin.headers
      .getSetCookie()
      .find((c) => c.startsWith("__Host-atlas_oauth="))!
      .split(";")[0]!;
    const response = await request(github.authorize(begin.headers.get("location")!, user), {
      headers: { cookie: browser },
    });
    const cookie = response.headers
      .getSetCookie()
      .find((c) => c.startsWith("__Host-atlas_session="))!
      .split(";")[0]!;
    const profile = await (
      await request("/api/profile", { headers: { cookie } })
    ).json<{ user: { id: number }; csrfToken: string; sources: { id: string }[] }>();
    return { cookie, profile };
  };
  const register = async (extra = {}) => {
    const response = await request("/agent/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_name: "Synthetic agent",
        redirect_uris: ["http://127.0.0.1:4199/callback"],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        ...extra,
      }),
    });
    return response;
  };
  const token = (form: URLSearchParams) =>
    request("/agent/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
  const connect = async (
    user: Awaited<ReturnType<typeof login>>,
    decision = "approve",
    exchangeCode = true,
  ) => {
    const registered = await register();
    expect(registered.status).toBe(201);
    const { client_id: clientId } = await registered.json<{ client_id: string }>();
    const verifier = "v".repeat(43);
    const challenge = btoa(
      String.fromCharCode(
        ...new Uint8Array(
          await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
        ),
      ),
    )
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replaceAll("=", "");
    const query = new URLSearchParams({
      client_id: clientId,
      redirect_uri: "http://127.0.0.1:4199/callback",
      response_type: "code",
      scope: "atlas:read",
      state: "synthetic-state",
      code_challenge: challenge,
      code_challenge_method: "S256",
      resource: `${origin}/mcp`,
    });
    const page = await request(`/agent/authorize?${query}`, { headers: { cookie: user.cookie } });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain(`numeric account ${user.profile.user.id}`);
    const consent = /name="consent" value="([^"]+)"/u.exec(html)![1]!;
    const form = new URLSearchParams({ consent, csrf: user.profile.csrfToken, decision });
    const forgery = new URLSearchParams(form);
    forgery.set("csrf", "forged");
    expect(
      (
        await request("/agent/authorize", {
          method: "POST",
          headers: {
            origin,
            cookie: user.cookie,
            "content-type": "application/x-www-form-urlencoded",
          },
          body: forgery.toString(),
        })
      ).status,
    ).toBe(403);
    const approve = () =>
      request("/agent/authorize", {
        method: "POST",
        headers: {
          origin,
          cookie: user.cookie,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });
    const response = await approve();
    expect(response.status).toBe(303);
    if (decision === "cancel") return { approve, response, query, html, clientId };
    const callback = new URL(response.headers.get("location")!);
    const codeForm = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      redirect_uri: "http://127.0.0.1:4199/callback",
      code: callback.searchParams.get("code")!,
      code_verifier: verifier,
      resource: `${origin}/mcp`,
    });
    if (!exchangeCode) return { approve, response, query, html, clientId, codeForm };
    const result = await token(codeForm);
    expect(result.status).toBe(200);
    const tokens = await result.json<{ access_token: string; refresh_token: string }>();
    return { approve, response, query, html, clientId, codeForm, tokens };
  };
  const client = async (accessToken: string) => {
    const sdk = new Client({ name: "standard-agent-proof", version: "1" });
    await sdk.connect(
      new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), {
        authProvider: { token: async () => accessToken },
        fetch: (input, init) => request(String(input), init),
      }),
    );
    return sdk;
  };
  return {
    github,
    request,
    login,
    register,
    connect,
    token,
    client,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe("Atlas read-only agent access", () => {
  it("distinguishes a deleted selected path from an empty repository and recovers the fixture", async () => {
    const h = harness();
    const alice = await h.login();
    const sourceId = alice.profile.sources[0]!.id;
    const read = () => h.request(`/api/sources/${sourceId}`, { headers: { cookie: alice.cookie } });
    const original = await (await read()).json<{ pack: { skills: { id: string }[] } }>();
    h.github.contentState.set(101, { revision: "e".repeat(40), deleted: true });
    const remaining = await read();
    expect(remaining.status).toBe(200);
    const pack = await remaining.json<{ pack: { skills: { id: string; slug: string }[] } }>();
    expect(pack.pack.skills.map((skill) => skill.slug)).toEqual(["retained-skill"]);
    expect(pack.pack.skills[0]!.id).not.toBe(original.pack.skills[0]!.id);
    h.github.contentState.set(101, { revision: "e".repeat(40), deleted: true, empty: true });
    const empty = await read();
    expect(empty.ok).toBe(false);
    expect(await empty.json()).toEqual({ error: { code: "empty-repository" } });
    h.github.contentState.delete(101);
    const recovered = await (await read()).json<{ pack: { skills: { id: string }[] } }>();
    expect(recovered.pack.skills[0]!.id).toBe(original.pack.skills[0]!.id);
  });

  it("rejects CSP wildcard/delimiter hosts at registration and from existing client metadata", async () => {
    const h = harness();
    const alice = await h.login();
    const prepared = await h.connect(alice, "cancel");
    const key = `client:${prepared.query.get("client_id")}`;
    const metadata = await env.OAUTH_KV.get<Record<string, unknown>>(key, "json");
    expect(metadata).toBeTruthy();
    for (const uri of [
      "https://*/callback",
      "https://*.example.com/callback",
      "https://example.com;script-src/callback",
      "https://example.com,evil/callback",
      "https://example.com%3bscript-src/callback",
      "https://exam\tple.com/callback",
    ]) {
      expect((await h.register({ redirect_uris: [uri] })).status).toBe(400);
      // Simulate metadata registered before the validation fix, using actual KV.
      await env.OAUTH_KV.put(key, JSON.stringify({ ...metadata, redirectUris: [uri] }));
      const query = new URLSearchParams(prepared.query);
      query.set("redirect_uri", uri);
      for (const headers of [{ cookie: alice.cookie }, {}]) {
        const consent = await h.request(`/agent/authorize?${query}`, { headers });
        expect(consent.status).toBe(400);
        expect(consent.headers.get("location")).toBeNull();
        expect(consent.headers.get("content-security-policy")).not.toContain(uri);
        expect(await consent.text()).not.toContain("Approve read access");
      }
    }
  });

  it("preserves literal HTTPS/loopback callback hosts and ports with safe path serialization", async () => {
    const h = harness();
    const alice = await h.login();
    const prepared = await h.connect(alice, "cancel");
    for (const uri of [
      "https://agent.example:8443/callback",
      "http://127.0.0.1:4199/callback",
      "http://localhost:4199/callback",
      "http://[::1]:4199/callback",
      "https://agent.example:8443/call;back,done?client=one",
    ]) {
      const registration = await h.register({ redirect_uris: [uri] });
      expect(registration.status).toBe(201);
      const registered = await registration.json<{ client_id: string }>();
      const query = new URLSearchParams(prepared.query);
      query.set("client_id", registered.client_id);
      query.set("redirect_uri", uri);
      const consent = await h.request(`/agent/authorize?${query}`, {
        headers: { cookie: alice.cookie },
      });
      expect(consent.status).toBe(200);
      const policy = consent.headers.get("content-security-policy")!;
      expect(policy.split(";")).toHaveLength(10);
      expect(policy).toContain(` ${new URL(uri).origin}/`);
      expect(policy).not.toContain("client=one");
      if (uri.includes("call;")) expect(policy).toContain("/call%3Bback%2Cdone");
    }
  });

  it("cancels an oversized still-open request without Content-Length before the deadline", async () => {
    const h = harness();
    let cancelled = false;
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(value) {
        controller = value;
        value.enqueue(new Uint8Array(16385));
      },
      cancel() {
        cancelled = true;
      },
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const response = await Promise.race([
        h.request("/agent/register", { method: "POST", body }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Streaming limit deadline exceeded")), 1000);
        }),
      ]);
      expect(response.status).toBe(413);
      expect(cancelled).toBe(true);
    } finally {
      if (timer) clearTimeout(timer);
      if (!cancelled) {
        controller.close();
      }
    }
    const payload = JSON.stringify({
      client_name: "Bounded stream",
      redirect_uris: ["http://127.0.0.1:4199/callback"],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    });
    const valid = new ReadableStream<Uint8Array>({
      start(value) {
        value.enqueue(new TextEncoder().encode(payload));
        value.close();
      },
    });
    expect(
      (
        await h.request("/agent/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: valid,
        })
      ).status,
    ).toBe(201);
  });

  it("distinguishes empty, complete, partial and unavailable inventories without denied metadata", async () => {
    const h = harness();
    const alice = await h.login();
    const connection = await h.connect(alice);
    const sdk = await h.client(connection.tokens!.access_token);
    const inventory = async () => {
      const result = await sdk.callTool({ name: "list_sources", arguments: {} });
      expect(result.isError).not.toBe(true);
      return JSON.parse((result.content as { text: string }[])[0]!.text);
    };
    try {
      expect(await inventory()).toMatchObject({ complete: true, limit: MAX_SOURCES });
      await h.request("/api/sources", {
        method: "POST",
        headers: {
          origin,
          cookie: alice.cookie,
          "content-type": "application/json",
          "x-atlas-csrf": alice.profile.csrfToken,
        },
        body: JSON.stringify({ repository: "fixture-alice/private-skills" }),
      });
      h.github.repositories[1]!.users = [];
      const partial = await inventory();
      expect(partial.complete).toBe(false);
      expect(partial.sources).toHaveLength(1);
      expect(partial.warning).toBeTruthy();
      expect(JSON.stringify(partial)).not.toContain("private-skills");
      expect(JSON.stringify(partial)).not.toContain("201");
      const original = h.github.fetcher;
      h.github.fetcher = async (input, init) =>
        String(input).includes("/repositories/") || String(input).includes("/repos/")
          ? new Response(null, { status: 503 })
          : original(input, init);
      const unavailable = await inventory();
      expect(unavailable).toMatchObject({ complete: false, sources: [], limit: MAX_SOURCES });
      expect(JSON.stringify(unavailable)).not.toContain("Global-Skills");
      h.github.fetcher = original;
      await env.DB.prepare("DELETE FROM sources WHERE user_id = 11").run();
      expect(await inventory()).toEqual({ complete: true, sources: [], limit: MAX_SOURCES });
    } finally {
      await sdk.close();
    }
  });

  it("scopes consent CSP to its validated callback and rejects an unregistered destination", async () => {
    const h = harness();
    const alice = await h.login();
    const prepared = await h.connect(alice, "cancel");
    const page = await h.request(`/agent/authorize?${prepared.query}`, {
      headers: { cookie: alice.cookie },
    });
    expect(page.headers.get("content-security-policy")).toContain(
      "form-action 'self' https://github.com http://127.0.0.1:4199/callback",
    );
    const anonymous = await h.request(`/agent/authorize?${prepared.query}`);
    expect(anonymous.headers.get("content-security-policy")).not.toContain("4199");
    const wrong = new URLSearchParams(prepared.query);
    wrong.set("redirect_uri", "http://127.0.0.1:4199/unregistered");
    const denied = await h.request(`/agent/authorize?${wrong}`, {
      headers: { cookie: alice.cookie },
    });
    expect(denied.status).toBe(400);
    expect(denied.headers.get("location")).toBeNull();
    expect(denied.headers.get("content-security-policy")).not.toContain("4199");
  });
  it("bounds search pages and explicit output without mutating source metadata", async () => {
    const h = harness();
    const alice = await h.login();
    const c = await h.connect(alice);
    const sourceId = alice.profile.sources[0]!.id;
    const source = await (
      await h.request(`/api/sources/${sourceId}`, { headers: { cookie: alice.cookie } })
    ).json<{ pack: { skills: { id: string; markdown: string }[] } }>();
    const before = await env.DB.prepare("SELECT * FROM sources WHERE id = ?")
      .bind(sourceId)
      .first();
    const original = h.github.fetcher;
    const variants = Array.from({ length: 25 }, (_, index) => ({
      sha: (index + 1).toString(16).padStart(40, "0"),
      path: `skills/fixture-${index}/SKILL.md`,
      markdown: source.pack.skills[0]!.markdown.replace(
        "name: fixture-skill",
        `name: fixture-${index}`,
      ),
    }));
    h.github.fetcher = async (input, init) => {
      const variant = variants.find((row) => String(input).endsWith(`/git/blobs/${row.sha}`));
      if (variant)
        return Response.json({
          encoding: "base64",
          content: btoa(variant.markdown),
          size: variant.markdown.length,
          sha: variant.sha,
        });
      const response = await original(input, init);
      if (!String(input).includes("/git/trees/")) return response;
      const tree = await response.json<{ tree: Record<string, unknown>[] }>();
      return Response.json({
        truncated: false,
        tree: variants.map((row) => ({
          ...tree.tree[0],
          path: row.path,
          sha: row.sha,
          size: row.markdown.length,
        })),
      });
    };
    const sdk = await h.client(c.tokens!.access_token);
    try {
      const readPage = async (offset: number) => {
        const result = await sdk.callTool({
          name: "search_skills",
          arguments: { sourceId, query: "fixture", offset },
        });
        expect(result.isError).not.toBe(true);
        return JSON.parse((result.content as { text: string }[])[0]!.text);
      };
      const first = await readPage(0);
      const last = await readPage(20);
      expect(first.results).toHaveLength(20);
      expect(first.nextOffset).toBe(20);
      expect(last.results).toHaveLength(5);
      expect(last.nextOffset).toBeNull();
      expect(JSON.stringify(first)).not.toContain('"markdown"');
      expect(
        await env.DB.prepare("SELECT * FROM sources WHERE id = ?").bind(sourceId).first(),
      ).toEqual(before);
      h.github.fetcher = original;
      h.github.repositories[0]!.marker = String.fromCharCode(1).repeat(50000);
      const oversized = await sdk.callTool({
        name: "read_skill",
        arguments: { sourceId, skillId: source.pack.skills[0]!.id },
      });
      expect(oversized.isError).toBe(true);
      expect(JSON.stringify(oversized)).toContain("response-limit");
      const write = await h.request("/api/sources", {
        method: "POST",
        headers: {
          origin,
          authorization: `Bearer ${c.tokens!.access_token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ repository: "fixture-alice/private-skills" }),
      });
      expect(write.status).toBe(401);
    } finally {
      await sdk.close();
    }
  });
  it("denies expired codes, wrong PKCE, oversized input and refresh scope escalation", async () => {
    const h = harness();
    const alice = await h.login();
    const pending = await h.connect(alice, "approve", false);
    const wrong = new URLSearchParams(pending.codeForm!);
    wrong.set("code_verifier", "x".repeat(43));
    expect((await h.token(wrong)).status).toBe(400);
    h.advance(600001);
    expect((await h.token(pending.codeForm!)).status).toBe(400);
    expect(
      (await h.request("/agent/register", { method: "POST", body: "x".repeat(16385) })).status,
    ).toBe(413);
    const fresh = await h.connect(alice);
    const unsupported = await h.request("/mcp", {
      method: "POST",
      headers: {
        authorization: `Bearer ${fresh.tokens!.access_token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "subscriptions/listen", params: {} }),
    });
    expect(unsupported.status).toBe(400);
    const form = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: fresh.clientId,
      refresh_token: fresh.tokens!.refresh_token,
      scope: "atlas:write",
      resource: `${origin}/mcp`,
    });
    expect((await h.token(form)).status).toBe(400);
    h.advance(300001);
    expect(
      (
        await h.request("/mcp", {
          headers: { authorization: `Bearer ${fresh.tokens!.access_token}` },
        })
      ).status,
    ).toBe(401);
  });
  it.each(["disconnect", "everywhere", "lease"])(
    "blocks an in-flight skill body after %s",
    async (kind) => {
      const h = harness();
      const alice = await h.login();
      const c = await h.connect(alice);
      const sourceId = alice.profile.sources[0]!.id;
      const source = await (
        await h.request(`/api/sources/${sourceId}`, { headers: { cookie: alice.cookie } })
      ).json<{ pack: { skills: { id: string }[] } }>();
      const sdk = await h.client(c.tokens!.access_token);
      let release!: () => void;
      let entered!: () => void;
      const pending = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const original = h.github.fetcher;
      let paused = false;
      h.github.fetcher = async (input, init) => {
        if (!paused && String(input).includes("/git/blobs/")) {
          paused = true;
          await new Promise<void>((resolve) => {
            release = resolve;
            entered();
          });
        }
        return original(input, init);
      };
      const reading = sdk.callTool({
        name: "read_skill",
        arguments: { sourceId, skillId: source.pack.skills[0]!.id },
      });
      const observed = reading.then(
        (result) => JSON.stringify(result),
        () => "denied",
      );
      await pending;
      if (kind === "lease") h.advance(300001);
      else if (kind === "everywhere")
        await h.request("/api/signout-everywhere", {
          method: "POST",
          headers: { origin, cookie: alice.cookie, "x-atlas-csrf": alice.profile.csrfToken },
        });
      else {
        const rows = await (
          await h.request("/api/connections", { headers: { cookie: alice.cookie } })
        ).json<{ connections: { id: string }[] }>();
        await h.request(`/api/connections/${rows.connections[0]!.id}`, {
          method: "DELETE",
          headers: { origin, cookie: alice.cookie, "x-atlas-csrf": alice.profile.csrfToken },
        });
      }
      release();
      h.github.fetcher = original;
      expect(await observed).not.toContain("SYNTHETIC");
      await sdk.close();
    },
  );
  it("uses standard MCP, matches browser ID/SHA, keeps GitHub tokens out, survives browser logout and immediately disconnects", async () => {
    const h = harness();
    const alice = await h.login();
    const connection = await h.connect(alice);
    const sdk = await h.client(connection.tokens!.access_token);
    try {
      expect((await sdk.listTools()).tools.map((t) => t.name)).toEqual([
        "connection_identity",
        "list_sources",
        "search_skills",
        "read_skill",
        "read_relations",
      ]);
      const sourceId = alice.profile.sources[0]!.id;
      const browser = await (
        await h.request(`/api/sources/${sourceId}`, { headers: { cookie: alice.cookie } })
      ).json<{ pack: { revision: string; skills: { id: string }[] } }>();
      const result = await sdk.callTool({
        name: "read_skill",
        arguments: { sourceId, skillId: browser.pack.skills[0]!.id },
      });
      const serialized = JSON.stringify(result);
      expect(serialized).toContain(browser.pack.revision);
      expect(serialized).not.toContain("fixture-user-token");
      const content = JSON.parse((result.content as { text: string }[])[0]!.text);
      expect(new URL(content.url).searchParams.get("skill")).toBe(browser.pack.skills[0]!.id);
      expect(new URL(content.url).searchParams.get("account")).toBe("11");
      const search = await sdk.callTool({
        name: "search_skills",
        arguments: { sourceId, query: "skill" },
      });
      expect(JSON.stringify(search)).not.toContain('"markdown"');
      await expect(
        sdk.callTool({ name: "remove_source", arguments: { sourceId } }),
      ).rejects.toThrow("not found");
      await h.request("/api/session", {
        method: "DELETE",
        headers: { origin, cookie: alice.cookie, "x-atlas-csrf": alice.profile.csrfToken },
      });
      expect((await sdk.callTool({ name: "connection_identity", arguments: {} })).isError).not.toBe(
        true,
      );
      const again = await h.login();
      const list = await (
        await h.request("/api/connections", { headers: { cookie: again.cookie } })
      ).json<{ connections: { id: string }[] }>();
      expect(list.connections).toHaveLength(1);
      await h.request(`/api/connections/${list.connections[0]!.id}`, {
        method: "DELETE",
        headers: { origin, cookie: again.cookie, "x-atlas-csrf": again.profile.csrfToken },
      });
      await expect(sdk.callTool({ name: "connection_identity", arguments: {} })).rejects.toThrow();
      expect((await h.token(connection.codeForm!)).status).toBe(400);
    } finally {
      await sdk.close();
    }
  });

  it("denies cancellation/replay, cookie or GitHub tokens, hostile registration, scope and cross-account reads", async () => {
    const h = harness();
    const alice = await h.login();
    const bob = await h.login("bob");
    const cancelled = await h.connect(alice, "cancel");
    expect((await cancelled.approve()).status).toBe(400);
    expect(await env.DB.prepare("SELECT count(*) AS n FROM agent_connections").first("n")).toBe(0);
    expect((await h.register({ scope: "atlas:write" })).status).toBe(400);
    expect((await h.register({ redirect_uris: ["javascript:alert(1)"] })).status).toBe(400);
    expect((await h.register({ logo_uri: "http://localhost/private" })).status).toBe(400);
    expect((await h.request("/mcp", { headers: { cookie: alice.cookie } })).status).toBe(401);
    expect(
      (await h.request("/mcp", { headers: { authorization: "Bearer fixture-user-token-11" } }))
        .status,
    ).toBe(401);
    const connected = await h.connect(alice);
    expect((await connected.approve()).status).toBe(400);
    const wrong = new URLSearchParams(connected.query);
    wrong.set("scope", "atlas:write");
    expect(
      (await h.request(`/agent/authorize?${wrong}`, { headers: { cookie: alice.cookie } })).status,
    ).toBe(400);
    wrong.set("scope", "atlas:read");
    wrong.set("resource", "https://foreign.example/mcp");
    expect(
      (await h.request(`/agent/authorize?${wrong}`, { headers: { cookie: alice.cookie } })).status,
    ).toBeGreaterThanOrEqual(400);
    const sdk = await h.client(connected.tokens!.access_token);
    try {
      expect(
        (
          await sdk.callTool({
            name: "read_skill",
            arguments: { sourceId: bob.profile.sources[0]!.id, skillId: "private" },
          })
        ).isError,
      ).toBe(true);
    } finally {
      await sdk.close();
    }
  });

  it("rotates Atlas refresh once, bounds upstream expiry, and revokes all credentials on sign out everywhere", async () => {
    const h = harness();
    const alice = await h.login();
    const c = await h.connect(alice);
    const form = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: c.clientId,
      refresh_token: c.tokens!.refresh_token,
      resource: `${origin}/mcp`,
    });
    const refreshed = await h.token(form);
    expect(refreshed.status, await refreshed.clone().text()).toBe(200);
    expect((await h.token(form)).status).toBe(400);
    const tokens = await refreshed.json<{ access_token: string; refresh_token: string }>();
    const signedOut = await h.request("/api/signout-everywhere", {
      method: "POST",
      headers: { origin, cookie: alice.cookie, "x-atlas-csrf": alice.profile.csrfToken },
    });
    expect(signedOut.status).toBe(200);
    expect(
      (await h.request("/mcp", { headers: { authorization: `Bearer ${tokens.access_token}` } }))
        .status,
    ).toBe(401);
    form.set("refresh_token", tokens.refresh_token);
    expect((await h.token(form)).status).toBe(400);
    expect(await env.DB.prepare("SELECT count(*) AS n FROM credentials").first("n")).toBe(0);
    const again = await h.login();
    const fresh = await h.connect(again);
    h.advance(28800001);
    expect(
      (
        await h.request("/mcp", {
          headers: { authorization: `Bearer ${fresh.tokens!.access_token}` },
        })
      ).status,
    ).toBe(401);
  });

  it("allows CSRF-bound disconnect and global sign out while GitHub is unavailable", async () => {
    const h = harness();
    const alice = await h.login();
    await h.connect(alice);
    const rows = await (
      await h.request("/api/connections", { headers: { cookie: alice.cookie } })
    ).json<{ connections: { id: string }[] }>();
    h.github.fetcher = async () => new Response(null, { status: 503 });
    expect(
      (
        await h.request(`/api/connections/${rows.connections[0]!.id}`, {
          method: "DELETE",
          headers: { origin, cookie: alice.cookie, "x-atlas-csrf": alice.profile.csrfToken },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await h.request("/api/signout-everywhere", {
          method: "POST",
          headers: { origin, cookie: alice.cookie, "x-atlas-csrf": alice.profile.csrfToken },
        })
      ).status,
    ).toBe(200);
    expect(await env.DB.prepare("SELECT count(*) AS n FROM credentials").first("n")).toBe(0);
  });
});
