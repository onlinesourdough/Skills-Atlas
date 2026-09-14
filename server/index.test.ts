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

describe("deprecated public preview boundary", () => {
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

  it("denies every proposal before any provider call", async () => {
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

  it("retires shared admin credentials and never establishes a session", async () => {
    const origin = await start({ adminPassword: "admin-secret", githubToken: "server-token" });
    for (const requestOrigin of [origin, "https://attacker.example"]) {
      const response = await fetch(`${origin}/api/session/login`, {
        method: "POST",
        headers: { origin: requestOrigin, "content-type": "application/json" },
        body: JSON.stringify({ password: "admin-secret" }),
      });
      expect(response.status).toBe(410);
      expect(response.headers.get("set-cookie")).toBeNull();
    }
    expect(await acceptedSession(await fetch(`${origin}/api/session`))).toBe(false);
    const health = await fetch(`${origin}/api/health`);
    expect(await health.json()).toMatchObject({
      adminConfigured: false,
      githubConfigured: false,
      sessions: "none",
    });
  });
});

async function acceptedSession(response: Response): Promise<boolean> {
  const body = (await response.json()) as { authenticated?: unknown };
  return body.authenticated === true;
}
