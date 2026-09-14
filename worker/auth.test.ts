import { applyD1Migrations, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import migration from "../migrations/0001_personal_profiles.sql?raw";
import agentMigration from "../migrations/0002_agent_credentials.sql?raw";
import { githubFixture, type FixtureUser } from "../scripts/fixtures/github.js";
import { handleRequest } from "./index.js";
import { GitHubIdentity } from "./github.js";
import { deploymentPolicy, hash, READ_LEASE_MS, unseal } from "./security.js";

const origin = "https://atlas.example";
const fixtureKey = btoa("0123456789abcdef0123456789abcdef");

function testEnv(overrides: Partial<Env> = {}): Env {
  return {
    ...env,
    ATLAS_ORIGIN: origin,
    ATLAS_DEPLOYMENT: "hosted",
    ATLAS_LOCAL_HTTP: "false",
    ATLAS_ALLOWED_ORG: "onlinesourdough",
    ATLAS_ALLOWED_USER_IDS: "",
    ATLAS_DEFAULT_REPOSITORY: "onlinesourdough/Global-Skills",
    GITHUB_CLIENT_ID: "fixture-client-id",
    GITHUB_CLIENT_SECRET: "fixture-client-secret",
    ATLAS_ENCRYPTION_KEY: fixtureKey,
    ...overrides,
  };
}

function jar(response: Response, previous = ""): string {
  const values = new Map(
    previous
      .split("; ")
      .filter(Boolean)
      .map((item) => [item.slice(0, item.indexOf("=")), item]),
  );
  for (const value of response.headers.getSetCookie()) {
    const entry = value.split(";")[0]!;
    const name = entry.slice(0, entry.indexOf("="));
    if (value.includes("Max-Age=0")) values.delete(name);
    else values.set(name, entry);
  }
  return [...values.values()].join("; ");
}

function harness(overrides: Partial<Env> = {}) {
  const runtime = testEnv(overrides);
  const github = githubFixture();
  let now = Date.now();
  const request = (
    path: string,
    options: {
      method?: string;
      cookie?: string;
      csrf?: string;
      body?: unknown;
      origin?: string;
      fetcher?: typeof fetch;
    } = {},
  ) => {
    const headers = new Headers({ origin: options.origin ?? runtime.ATLAS_ORIGIN });
    if (options.cookie) headers.set("cookie", options.cookie);
    if (options.csrf) headers.set("x-atlas-csrf", options.csrf);
    if (options.body !== undefined) headers.set("content-type", "application/json");
    return handleRequest(
      new Request(new URL(path, runtime.ATLAS_ORIGIN), {
        method: options.method ?? "GET",
        headers,
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      }),
      runtime,
      { fetcher: options.fetcher ?? github.fetcher, now: () => now },
    );
  };
  const start = async (cookie = "") => {
    const response = await request("/auth/github/login", { method: "POST", cookie });
    expect(response.status).toBe(303);
    return { url: response.headers.get("location")!, cookie: jar(response, cookie), response };
  };
  const login = async (user: FixtureUser = "alice", cookie = "", lifetime = 28800) => {
    const begun = await start(cookie);
    const callback = github.authorize(begun.url, user, lifetime);
    const response = await request(callback, { cookie: begun.cookie });
    return { cookie: jar(response, begun.cookie), response, callback, begun };
  };
  const profile = async (cookie: string) => {
    const response = await request("/api/profile", { cookie });
    expect(response.status).toBe(200);
    return response.json<{
      user: { id: number; login: string };
      csrfToken: string;
      authorizedUntil: number;
      expiresAt: number;
      sources: Array<{
        id: string;
        repositoryId: number | null;
        repository: string;
        visible: boolean;
        available: boolean;
      }>;
    }>();
  };
  return {
    runtime,
    github,
    request,
    start,
    login,
    profile,
    advance: (ms: number) => {
      now += ms;
    },
    now: () => now,
  };
}

beforeEach(async () => {
  await applyD1Migrations(env.DB, [
    {
      name: "0001_personal_profiles.sql",
      queries: migration
        .split(";")
        .map((sql) => sql.trim())
        .filter(Boolean),
    },
    {
      name: "0002_agent_credentials.sql",
      queries: agentMigration
        .split(";")
        .map((sql) => sql.trim())
        .filter(Boolean),
    },
  ]);
  await env.DB.batch(
    [
      "agent_consents",
      "agent_connections",
      "sessions",
      "credentials",
      "oauth_attempts",
      "sources",
      "profiles",
    ].map((table) => env.DB.prepare(`DELETE FROM ${table}`)),
  );
});

describe("GitHub App personal login and scoped D1 service", () => {
  it("logout with a pending browser cookie revokes a just-completed callback before its session cookie is received", async () => {
    const h = harness();
    const begun = await h.start();
    const callback = await h.request(h.github.authorize(begun.url, "alice"), {
      cookie: begun.cookie,
    });
    const issued = jar(callback, begun.cookie);
    expect(
      (await h.request("/api/session", { method: "DELETE", cookie: begun.cookie })).status,
    ).toBe(200);
    expect((await h.request("/api/profile", { cookie: issued })).status).toBe(401);
  });

  it("does not retarget a saved numeric identity when another repository reuses its old name", async () => {
    const h = harness();
    const login = await h.login();
    const p = await h.profile(login.cookie);
    const importing = (repository: string) =>
      h.request("/api/sources", {
        method: "POST",
        cookie: login.cookie,
        csrf: p.csrfToken,
        body: { repository },
      });
    const first = await (
      await importing("fixture-alice/private-skills")
    ).json<{ source: { id: string } }>();
    h.github.repositories[1]!.name = "fixture-alice/renamed-skills";
    h.github.repositories.push({
      id: 999,
      name: "fixture-alice/private-skills",
      users: [11],
      installed: true,
      marker: "REUSED NAME SYNTHETIC CONTENT",
    });
    expect((await importing("fixture-alice/private-skills")).status).toBe(409);
    expect(
      await env.DB.prepare("SELECT repository_id FROM sources WHERE id = ?")
        .bind(first.source.id)
        .first("repository_id"),
    ).toBe(201);
    expect(
      (await h.request(`/api/sources/${first.source.id}`, { cookie: login.cookie })).status,
    ).toBe(200);
    const second = await (
      await importing("fixture-alice/private-skills")
    ).json<{ source: { id: string; repositoryId: number } }>();
    expect(second.source.repositoryId).toBe(999);
    expect(second.source.id).not.toBe(first.source.id);
  });
  it("preserves hidden preferences across duplicate imports, caps sources atomically and keeps a removed default removed", async () => {
    const h = harness();
    const login = await h.login();
    const p = await h.profile(login.cookie);
    const original = p.sources[0]!.id;
    await h.request(`/api/sources/${original}`, {
      method: "DELETE",
      cookie: login.cookie,
      csrf: p.csrfToken,
    });
    const relogin = await h.login("alice", login.cookie);
    const restored = await h.profile(relogin.cookie);
    expect(restored.sources).toHaveLength(0);
    const importing = () =>
      h.request("/api/sources", {
        method: "POST",
        cookie: relogin.cookie,
        csrf: restored.csrfToken,
        body: { repository: "fixture-alice/private-skills" },
      });
    const imported = await (await importing()).json<{ source: { id: string } }>();
    await h.request(`/api/sources/${imported.source.id}`, {
      method: "PATCH",
      cookie: relogin.cookie,
      csrf: restored.csrfToken,
      body: { visible: false },
    });
    const duplicates = await Promise.all([importing(), importing()]);
    for (const result of duplicates)
      expect(await result.json()).toMatchObject({
        source: { id: imported.source.id, visible: false },
      });
    expect((await h.profile(relogin.cookie)).sources).toHaveLength(1);
    await env.DB.batch(
      Array.from({ length: 19 }, (_, index) =>
        env.DB.prepare(
          "INSERT INTO sources (id, user_id, repository_id, repository, visible, created_at) VALUES (?, 11, ?, ?, 0, 0)",
        ).bind(crypto.randomUUID(), 1000 + index, `fixture-alice/extra-${index}`),
      ),
    );
    expect((await importing()).status).toBe(200);
    expect(
      (
        await h.request("/api/sources", {
          method: "POST",
          cookie: relogin.cookie,
          csrf: restored.csrfToken,
          body: { repository: "fixture-team/shared-skills" },
        })
      ).status,
    ).toBe(409);
    expect(
      await env.DB.prepare("SELECT count(*) AS n FROM sources WHERE user_id=11").first("n"),
    ).toBe(20);
  });

  it("cancels an in-flight callback on logout and retains no session from its delayed exchange", async () => {
    const h = harness();
    const begun = await h.start();
    const callback = h.github.authorize(begun.url, "alice");
    let release!: () => void;
    let started!: () => void;
    const pending = new Promise<void>((resolve) => {
      started = resolve;
    });
    const fetcher: typeof fetch = async (input, init) => {
      if (String(input).includes("/login/oauth/access_token"))
        await new Promise<void>((resolve) => {
          release = resolve;
          started();
        });
      return h.github.fetcher(input, init);
    };
    const completing = h.request(callback, { cookie: begun.cookie, fetcher });
    await pending;
    expect(
      (await h.request("/api/session", { method: "DELETE", cookie: begun.cookie })).status,
    ).toBe(200);
    release();
    expect((await completing).headers.get("location")).toContain("authError=");
    expect(await env.DB.prepare("SELECT count(*) AS n FROM sessions").first("n")).toBe(0);
    expect(await env.DB.prepare("SELECT count(*) AS n FROM profiles").first("n")).toBe(0);
  });

  it("ignores identity headers, rejects duplicate cookies and invalidates a changed deployment policy", async () => {
    const h = harness();
    const login = await h.login();
    const spoof = await handleRequest(
      new Request(`${origin}/api/profile`, {
        headers: {
          "x-github-user-id": "11",
          "cf-access-authenticated-user-email": "alice@example.invalid",
        },
      }),
      h.runtime,
      { fetcher: h.github.fetcher },
    );
    expect(spoof.status).toBe(401);
    expect(
      (await h.request("/api/profile", { cookie: `${login.cookie}; ${login.cookie}` })).status,
    ).toBe(401);
    const changed = harness({
      ATLAS_DEPLOYMENT: "self-hosted",
      ATLAS_ALLOWED_ORG: "",
      ATLAS_ALLOWED_USER_IDS: "11",
    });
    expect((await changed.request("/api/profile", { cookie: login.cookie })).status).toBe(401);
    expect(changed.github.calls).toHaveLength(0);
  });
  it("exchanges through the OAuth client with PKCE", async () => {
    const h = harness();
    const provider = new GitHubIdentity(h.github.fetcher);
    const policy = await deploymentPolicy(h.runtime);
    const state = "a".repeat(43);
    const verifier = "b".repeat(43);
    const url = await provider.authorizationUrl(policy, state, verifier);
    await expect(
      provider.exchange(policy, new URL(h.github.authorize(url, "alice")), state, verifier),
    ).resolves.toMatchObject({ token: "fixture-user-token-11" });
  });
  it("uses state/PKCE/exact callback, encrypted upstream tokens, secure opaque cookies and stable profiles", async () => {
    const h = harness();
    const login = await h.login();
    expect(login.response.headers.get("location")).toBe(`${origin}/#graph`);
    const authUrl = new URL(login.begun.url);
    expect(authUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authUrl.searchParams.get("code_challenge")).toHaveLength(43);
    expect(authUrl.searchParams.get("redirect_uri")).toBe(`${origin}/auth/github/callback`);
    expect(login.response.headers.getSetCookie().join("\n")).toContain("HttpOnly; SameSite=Lax");
    expect(login.response.headers.getSetCookie().join("\n")).toContain("Secure");
    expect(login.cookie).toMatch(/^__Host-atlas_session=[A-Za-z0-9_-]{43}$/u);
    const profile = await h.profile(login.cookie);
    expect(profile.user).toEqual({ id: 11, login: "fixture-alice" });
    expect(profile.sources).toHaveLength(1);
    expect(profile.authorizedUntil - h.now()).toBeLessThanOrEqual(READ_LEASE_MS);
    const row = await env.DB.prepare(
      "SELECT s.*, c.token_ciphertext FROM sessions s JOIN credentials c ON c.id = s.credential_id",
    ).first<{
      session_hash: string;
      credential_id: string;
      token_ciphertext: string;
      user_id: number;
      policy_key: string;
    }>();
    expect(JSON.stringify(row)).not.toContain("fixture-user-token");
    expect(JSON.stringify(row)).not.toContain(login.cookie.split("=")[1]);
    expect(
      await unseal(
        row!.token_ciphertext,
        fixtureKey,
        `${row!.policy_key}:credential:${row!.credential_id}:11`,
      ),
    ).toBe("fixture-user-token-11");
    expect(await env.DB.prepare("SELECT count(*) AS n FROM oauth_attempts").first("n")).toBe(0);
    const second = await h.login("alice", login.cookie);
    expect(second.cookie).not.toBe(login.cookie);
    expect((await h.request("/api/profile", { cookie: login.cookie })).status).toBe(401);
    expect((await h.profile(second.cookie)).user.id).toBe(profile.user.id);
    expect(await env.DB.prepare("SELECT count(*) AS n FROM profiles").first("n")).toBe(1);
  });

  it.each(["pending", "nonmember", "outside"] as const)(
    "denies %s without creating a profile or session",
    async (user) => {
      const h = harness();
      const login = await h.login(user);
      expect(login.response.headers.get("location")).toContain("authError=");
      expect(login.cookie).toBe("");
      expect(await env.DB.prepare("SELECT count(*) AS n FROM profiles").first("n")).toBe(0);
      expect(await env.DB.prepare("SELECT count(*) AS n FROM sessions").first("n")).toBe(0);
    },
  );

  it.each(["unknown", "rate-limited"] as const)(
    "fails closed for %s membership without extending authorization",
    async (membership) => {
      const h = harness();
      const login = await h.login();
      h.github.users.alice.membership = membership;
      const response = await h.request("/api/profile", { cookie: login.cookie });
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(await response.text()).not.toContain("sources");
      expect((await h.login()).response.headers.get("location")).toContain("authError=");
    },
  );

  it("rejects missing policy, hosted allowlist overrides and non-loopback insecure origins", async () => {
    for (const values of [
      { ATLAS_ALLOWED_ORG: "" },
      { ATLAS_ALLOWED_USER_IDS: "11" },
      { ATLAS_ORIGIN: "http://atlas.example", ATLAS_LOCAL_HTTP: "true" },
      { GITHUB_CLIENT_SECRET: "" },
      { ATLAS_ENCRYPTION_KEY: "bad-key" },
      { ATLAS_ORIGIN: "https://atlas.example/path" },
    ]) {
      const h = harness(values);
      expect((await h.request("/auth/github/login", { method: "POST" })).status).toBe(503);
      expect(h.github.calls).toHaveLength(0);
    }
  });

  it("supports an independent self-host numeric allowlist and constrains local HTTP cookies", async () => {
    const h = harness({
      ATLAS_DEPLOYMENT: "self-hosted",
      ATLAS_ALLOWED_ORG: "",
      ATLAS_ALLOWED_USER_IDS: "11",
      ATLAS_ORIGIN: "http://127.0.0.1:8787",
      ATLAS_LOCAL_HTTP: "true",
    });
    const alice = await h.login();
    expect(alice.cookie).toMatch(/^atlas_local_session=/u);
    expect((await h.profile(alice.cookie)).user.id).toBe(11);
    expect(h.github.calls.some((call) => call.path.includes("memberships"))).toBe(false);
    expect((await h.login("bob")).response.headers.get("location")).toContain("access-denied");
    expect((await deploymentPolicy(h.runtime)).organization).toBeNull();
  });

  it("binds callback to the browser and exact path, expires/rejects replay before token exchange", async () => {
    const h = harness();
    const begun = await h.start();
    const callback = h.github.authorize(begun.url, "alice");
    expect((await h.request(callback)).headers.get("location")).toContain("oauth-invalid");
    expect(h.github.tokenExchanges()).toBe(0);
    const wrongState = new URL(callback);
    wrongState.searchParams.set("state", "x".repeat(43));
    await h.request(wrongState.href, { cookie: begun.cookie });
    expect(h.github.tokenExchanges()).toBe(0);
    const extra = new URL(callback);
    extra.searchParams.set("redirect_uri", "https://attacker.example");
    await h.request(extra.href, { cookie: begun.cookie });
    expect(h.github.tokenExchanges()).toBe(0);
    const success = await h.request(callback, { cookie: begun.cookie });
    expect(success.headers.get("location")).toBe(`${origin}/#graph`);
    await h.request(callback, { cookie: begun.cookie });
    expect(h.github.tokenExchanges()).toBe(1);
    const expired = await h.start();
    h.advance(10 * 60 * 1000);
    const failure = await h.request(h.github.authorize(expired.url, "bob"), {
      cookie: expired.cookie,
    });
    expect(failure.headers.get("location")).toContain("oauth-expired");
    expect(h.github.tokenExchanges()).toBe(1);
  });

  it("rejects concurrent callback replay and a tampered verifier", async () => {
    const h = harness();
    const begun = await h.start();
    const callback = h.github.authorize(begun.url, "alice");
    const responses = await Promise.all([
      h.request(callback, { cookie: begun.cookie }),
      h.request(callback, { cookie: begun.cookie }),
    ]);
    expect(
      responses.filter((response) => response.headers.get("location") === `${origin}/#graph`),
    ).toHaveLength(1);
    expect(h.github.tokenExchanges()).toBe(1);
    const next = await h.start();
    await env.DB.prepare("UPDATE oauth_attempts SET verifier_ciphertext = 'tampered'").run();
    expect(
      (await h.request(h.github.authorize(next.url, "bob"), { cookie: next.cookie })).headers.get(
        "location",
      ),
    ).toContain("authError=");
    expect(h.github.tokenExchanges()).toBe(1);
  });

  it("isolates source preferences and reads for two users, restores choices and denies uninstalled repos", async () => {
    const h = harness();
    const alice = await h.login();
    const bob = await h.login("bob");
    const a = await h.profile(alice.cookie);
    const b = await h.profile(bob.cookie);
    const imported = await h.request("/api/sources", {
      method: "POST",
      cookie: alice.cookie,
      csrf: a.csrfToken,
      body: { repository: "fixture-alice/private-skills" },
    });
    expect(imported.status).toBe(200);
    const result = await imported.json<{
      source: { id: string };
      pack: { access: string; skills: Array<{ markdown: string }> };
    }>();
    expect(result.pack.access).toBe("read");
    expect(result.pack.skills[0]!.markdown).toContain("PRIVATE ALICE SYNTHETIC CONTENT");
    const path = `/api/sources/${result.source.id}`;
    const calls = h.github.calls.length;
    for (const method of ["GET", "PATCH", "DELETE"]) {
      expect(
        (
          await h.request(path, {
            method,
            cookie: bob.cookie,
            csrf: b.csrfToken,
            ...(method === "PATCH" ? { body: { visible: false } } : {}),
          })
        ).status,
      ).toBe(404);
    }
    expect(h.github.calls.slice(calls).some((call) => call.path.includes("private-skills"))).toBe(
      false,
    );
    expect((await h.profile(bob.cookie)).sources).toHaveLength(1);
    expect(
      (
        await h.request("/api/sources", {
          method: "POST",
          cookie: bob.cookie,
          csrf: b.csrfToken,
          body: { repository: "fixture-alice/private-skills" },
        })
      ).status,
    ).toBeGreaterThanOrEqual(400);
    expect(
      (
        await h.request("/api/sources", {
          method: "POST",
          cookie: alice.cookie,
          csrf: a.csrfToken,
          body: { repository: "fixture-alice/not-installed" },
        })
      ).status,
    ).toBeGreaterThanOrEqual(400);
    expect(
      (
        await h.request(path, {
          method: "PATCH",
          cookie: alice.cookie,
          csrf: a.csrfToken,
          body: { visible: false },
        })
      ).status,
    ).toBe(200);
    await h.request("/api/session", { method: "DELETE", cookie: alice.cookie, csrf: a.csrfToken });
    const again = await h.login();
    expect(
      (await h.profile(again.cookie)).sources.find((source) => source.id === result.source.id)
        ?.visible,
    ).toBe(false);
    expect((await h.profile(bob.cookie)).sources).toHaveLength(1);
    expect(await env.DB.prepare("SELECT count(*) AS n FROM profiles").first("n")).toBe(2);
    expect(JSON.stringify(await env.DB.prepare("SELECT * FROM sources").all())).not.toContain(
      "SYNTHETIC CONTENT",
    );
  });

  it("enforces origin, CSRF, no provider writes and no cross-deployment session reuse", async () => {
    const h = harness();
    expect((await h.request("/auth/github/login", { method: "POST", origin: "null" })).status).toBe(
      403,
    );
    expect(
      (
        await handleRequest(
          new Request(`${origin}/auth/github/login`, { method: "POST" }),
          testEnv(),
        )
      ).status,
    ).toBe(403);
    const document = await handleRequest(
      new Request(`${origin}/`),
      testEnv({
        ASSETS: {
          fetch: async () =>
            new Response("<!doctype html>", { headers: { "content-type": "text/html" } }),
        } as unknown as Fetcher,
      }),
    );
    expect(document.headers.get("referrer-policy")).toBe("strict-origin");
    const alice = await h.login();
    expect(alice.response.headers.get("referrer-policy")).toBe("no-referrer");
    const profile = await h.profile(alice.cookie);
    expect(
      (
        await h.request("/auth/github/login", {
          method: "POST",
          origin: "https://attacker.example",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await h.request("/api/sources", {
          method: "POST",
          cookie: alice.cookie,
          body: { repository: "fixture-alice/private-skills" },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await h.request("/api/session", {
          method: "DELETE",
          cookie: alice.cookie,
          csrf: profile.csrfToken,
          origin: "https://attacker.example",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await h.request("/api/proposals", {
          method: "POST",
          cookie: alice.cookie,
          csrf: profile.csrfToken,
        })
      ).status,
    ).toBe(403);
    expect(h.github.calls.every((call) => call.method === "GET")).toBe(true);
    const other = harness({ ATLAS_ORIGIN: "https://other.example" });
    expect((await other.request("/api/profile", { cookie: alice.cookie })).status).toBe(401);
    expect(other.github.calls).toHaveLength(0);
    expect(
      (await h.request("/api/profile", { cookie: alice.cookie })).headers.get("cache-control"),
    ).toContain("no-store");
  });

  it.each(["revoked", "membership", "expired", "repository"] as const)(
    "removes access after %s loss and does not serve a shared cached body",
    async (loss) => {
      const h = harness();
      const login = await h.login();
      const profile = await h.profile(login.cookie);
      const sourceId = profile.sources[0]!.id;
      expect((await h.request(`/api/sources/${sourceId}`, { cookie: login.cookie })).status).toBe(
        200,
      );
      if (loss === "revoked") h.github.users.alice.revoked = true;
      if (loss === "membership") h.github.users.alice.membership = "absent";
      if (loss === "expired") h.advance(8 * 60 * 60 * 1000);
      if (loss === "repository") h.github.repositories[0]!.users = [22];
      const response = await h.request(`/api/sources/${sourceId}`, { cookie: login.cookie });
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(await response.text()).not.toContain("SYNTHETIC DEFAULT");
      if (loss === "repository")
        expect((await h.profile(login.cookie)).sources[0]!.available).toBe(false);
    },
  );

  it("closes expired upstream sessions, binds ciphertext to its session/user and recovers by re-login", async () => {
    const h = harness();
    const alice = await h.login("alice", "", 2);
    expect((await h.profile(alice.cookie)).expiresAt - h.now()).toBe(2000);
    h.advance(2000);
    expect((await h.request("/api/profile", { cookie: alice.cookie })).status).toBe(401);
    const again = await h.login();
    const bob = await h.login("bob");
    const aHash = await hash(again.cookie.split("=")[1]!);
    const bHash = await hash(bob.cookie.split("=")[1]!);
    await env.DB.prepare(
      "UPDATE credentials SET token_ciphertext = (SELECT c.token_ciphertext FROM credentials c JOIN sessions s ON s.credential_id = c.id WHERE s.session_hash = ?) WHERE id = (SELECT credential_id FROM sessions WHERE session_hash = ?)",
    )
      .bind(aHash, bHash)
      .run();
    expect((await h.request("/api/profile", { cookie: bob.cookie })).status).toBe(401);
    expect((await h.profile(again.cookie)).user.id).toBe(11);
  });

  it.each(["/api/sources", "/api/sources/preview"])(
    "invalidates delayed %s on server logout",
    async (path) => {
      const h = harness();
      const login = await h.login();
      const profile = await h.profile(login.cookie);
      let release!: () => void;
      let started!: () => void;
      const pending = new Promise<void>((resolve) => {
        started = resolve;
      });
      const fetcher: typeof fetch = async (input, init) => {
        if (String(input).includes("/git/blobs/"))
          await new Promise<void>((resolve) => {
            release = resolve;
            started();
          });
        return h.github.fetcher(input, init);
      };
      const importing = h.request(path, {
        method: "POST",
        cookie: login.cookie,
        csrf: profile.csrfToken,
        body: { repository: "fixture-alice/private-skills" },
        fetcher,
      });
      await pending;
      expect(
        (
          await h.request("/api/session", {
            method: "DELETE",
            cookie: login.cookie,
            csrf: profile.csrfToken,
          })
        ).status,
      ).toBe(200);
      release();
      const response = await importing;
      expect(response.status).toBe(401);
      expect(await response.text()).not.toContain("PRIVATE ALICE");
      expect(
        await env.DB.prepare("SELECT count(*) AS n FROM sources WHERE repository_id = 201").first(
          "n",
        ),
      ).toBe(0);
    },
  );

  it("previews without saving, rechecks exact revision on confirmation and preserves duplicate visibility", async () => {
    const h = harness();
    const login = await h.login();
    const p = await h.profile(login.cookie);
    const repository = "fixture-alice/private-skills";
    const options = {
      method: "POST",
      cookie: login.cookie,
      csrf: p.csrfToken,
      body: { repository },
    };
    const response = await h.request("/api/sources/preview", options);
    expect(response.status).toBe(200);
    const preview = await response.json<{
      kind: string;
      pack: { repositoryId: number; revision: string };
      authorizedUntil: number;
    }>();
    expect(preview.kind).toBe("atlas-source-preview");
    expect(preview.authorizedUntil).toBeLessThanOrEqual(h.now() + READ_LEASE_MS);
    expect((await h.profile(login.cookie)).sources).toEqual(p.sources);
    h.github.contentState.set(201, { revision: "b".repeat(40), deleted: false });
    const confirming = () =>
      h.request("/api/sources", {
        ...options,
        body: {
          repository,
          expected: { repositoryId: preview.pack.repositoryId, revision: preview.pack.revision },
        },
      });
    expect((await confirming()).status).toBe(409);
    expect((await h.profile(login.cookie)).sources).toEqual(p.sources);
    h.github.contentState.set(201, { revision: preview.pack.revision, deleted: false });
    const confirmed = await confirming();
    expect(confirmed.status).toBe(200);
    const saved = await confirmed.json<{ source: { id: string } }>();
    await h.request(`/api/sources/${saved.source.id}`, {
      ...options,
      method: "PATCH",
      body: { visible: false },
    });
    for (const duplicate of await Promise.all([confirming(), confirming()])) {
      expect(duplicate.status).toBe(200);
      expect(await duplicate.json()).toMatchObject({
        source: { id: saved.source.id, visible: false },
      });
    }
    expect((await h.profile(login.cookie)).sources).toHaveLength(p.sources.length + 1);
  });

  it("denies preview without identity, CSRF, app/user access or a current lease", async () => {
    const h = harness();
    const login = await h.login();
    const p = await h.profile(login.cookie);
    const repository = "fixture-alice/private-skills";
    const options = {
      method: "POST",
      cookie: login.cookie,
      csrf: p.csrfToken,
      body: { repository },
    };
    expect((await h.request("/api/sources/preview", { ...options, cookie: "" })).status).toBe(401);
    expect((await h.request("/api/sources/preview", { ...options, csrf: "" })).status).toBe(403);
    expect(
      (await h.request("/api/sources/preview", { ...options, origin: "https://other.example" }))
        .status,
    ).toBe(403);
    expect(
      (
        await h.request("/api/sources/preview", {
          ...options,
          body: { repository: "fixture-bob/private-skills" },
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await h.request("/api/sources/preview", {
          ...options,
          body: { repository: "fixture-alice/not-installed" },
        })
      ).status,
    ).toBe(404);
    const fetcher: typeof fetch = async (input, init) => {
      if (String(input).includes("/git/blobs/")) h.advance(READ_LEASE_MS + 1);
      return h.github.fetcher(input, init);
    };
    const expired = await h.request("/api/sources/preview", { ...options, fetcher });
    expect(expired.status).toBe(503);
    expect(await expired.text()).not.toContain("PRIVATE ALICE");
    expect((await h.profile(login.cookie)).sources).toHaveLength(p.sources.length);
  });
});
