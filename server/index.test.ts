import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createAtlasServer } from "./index.js";

const servers: ReturnType<typeof createAtlasServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
});

async function start(options: Parameters<typeof createAtlasServer>[0] = {}): Promise<string> {
  const server = createAtlasServer(options);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

describe("self-hosted HTTP trust boundary", () => {
  it("keeps configured GitHub credentials out of anonymous imports and collapses 404", async () => {
    const authorizations: Array<string | null> = [];
    const origin = await start({
      adminPassword: "admin-secret",
      githubToken: "server-token",
      fetcher: async (_input, init) => {
        const headers = new Headers(init?.headers);
        authorizations.push(headers.get("authorization"));
        return new Response(JSON.stringify({ message: "Not Found" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      },
    });
    const response = await fetch(`${origin}/api/packs/import?repository=hidden/repo`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "repository-unavailable",
        message: "Repository unavailable or private.",
      },
    });
    expect(authorizations).toEqual([null]);
  });

  it("requires admin session before any proposal provider call", async () => {
    let providerCalls = 0;
    const origin = await start({
      adminPassword: "admin-secret",
      githubToken: "server-token",
      fetcher: async () => {
        providerCalls += 1;
        return new Response("{}", { status: 500 });
      },
    });
    const response = await fetch(`${origin}/api/proposals`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(response.status).toBe(401);
    expect(providerCalls).toBe(0);
  });

  it("uses the server token only after admin authentication and returns verified access", async () => {
    const commitSha = "a".repeat(40);
    const treeSha = "b".repeat(40);
    const fileSha = "c".repeat(40);
    const markdown = [
      "---",
      "name: private-skill",
      "description: A deterministic private-read contract skill.",
      "category: Operations",
      "---",
      "",
      "# Private skill",
      "",
      "Read only through the authenticated server boundary.",
    ].join("\n");
    const authorizations: Array<string | null> = [];
    const origin = await start({
      adminPassword: "admin-secret",
      githubToken: "server-token",
      fetcher: async (input, init) => {
        const url = new URL(String(input));
        authorizations.push(new Headers(init?.headers).get("authorization"));
        if (url.pathname === "/repos/private/team-skills") {
          return Response.json({
            full_name: "private/team-skills",
            html_url: "https://github.com/private/team-skills",
            default_branch: "main",
            permissions: { pull: true, push: true },
          });
        }
        if (url.pathname === "/repos/private/team-skills/branches/main") {
          return Response.json({
            commit: { sha: commitSha, commit: { tree: { sha: treeSha } } },
          });
        }
        if (url.pathname === `/repos/private/team-skills/git/trees/${treeSha}`) {
          return Response.json({
            truncated: false,
            tree: [
              {
                path: "skills/private-skill/SKILL.md",
                type: "blob",
                sha: fileSha,
                size: markdown.length,
              },
            ],
          });
        }
        if (url.pathname === `/repos/private/team-skills/git/blobs/${fileSha}`) {
          return Response.json({
            encoding: "base64",
            content: Buffer.from(markdown, "utf8").toString("base64"),
          });
        }
        return Response.json({ message: "unexpected" }, { status: 500 });
      },
    });
    const login = await fetch(`${origin}/api/session/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "admin-secret" }),
    });
    const cookie = login.headers.get("set-cookie") ?? "";
    const imported = await fetch(`${origin}/api/packs/import?repository=private/team-skills`, {
      headers: { cookie },
    });
    expect(imported.status).toBe(200);
    expect(await imported.json()).toMatchObject({
      repository: "private/team-skills",
      revision: commitSha,
      access: "write",
      skills: [{ slug: "private-skill", markdown }],
    });
    expect(authorizations).toHaveLength(4);
    expect(authorizations.every((value) => value === "Bearer server-token")).toBe(true);
  });

  it("creates a cookie session without returning the password or provider token", async () => {
    const origin = await start({ adminPassword: "admin-secret", githubToken: "server-token" });
    const denied = await fetch(`${origin}/api/session/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "wrong" }),
    });
    expect(denied.status).toBe(401);

    const accepted = await fetch(`${origin}/api/session/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "admin-secret" }),
    });
    const body = JSON.stringify(await accepted.json());
    expect(accepted.status).toBe(200);
    expect(accepted.headers.get("set-cookie")).toContain("HttpOnly");
    expect(body).not.toContain("admin-secret");
    expect(body).not.toContain("server-token");
    expect(body).toContain('"authenticated":true');
  });

  it("denies cross-origin login before reading credentials", async () => {
    const origin = await start({ adminPassword: "admin-secret" });
    const response = await fetch(`${origin}/api/session/login`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://attacker.example" },
      body: JSON.stringify({ password: "admin-secret" }),
    });
    expect(response.status).toBe(403);
    expect(await acceptedSession(await fetch(`${origin}/api/session`))).toBe(false);
  });
});

async function acceptedSession(response: Response): Promise<boolean> {
  const body = (await response.json()) as { authenticated?: unknown };
  return body.authenticated === true;
}
