import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { origin } from "./fixture-runtime.mjs";

// Real redirect target: Playwright routing only sees the first URL of a redirect.
// Values stay in memory and are accepted only for the expected client's state.
export async function startAgentCallback() {
  const pending = new Map();
  let completed = 0;
  const callbackOrigin = "http://127.0.0.1:4199";
  const listener = createServer((request, response) => {
    const url = new URL(request.url, callbackOrigin);
    const expected = pending.get(url.searchParams.get("state"));
    const accepted =
      request.method === "GET" &&
      request.headers.host === "127.0.0.1:4199" &&
      url.pathname === "/callback" &&
      expected &&
      url.searchParams.getAll("state").length === 1 &&
      url.searchParams.get("iss") === origin &&
      url.searchParams.has("code") !== url.searchParams.has("error");
    response.writeHead(accepted ? 200 : 400, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    });
    if (accepted) {
      expected.received = url.href;
      pending.delete(url.searchParams.get("state"));
      completed += 1;
    }
    response.end(accepted ? "Synthetic agent callback complete" : "Unexpected synthetic callback");
  });
  await new Promise((done, reject) => {
    listener.once("error", () => reject(new Error("Synthetic callback listener unavailable")));
    listener.listen({ host: "127.0.0.1", port: 4199, exclusive: true }, done);
  });
  return {
    expect(authorizationUrl) {
      const url = new URL(authorizationUrl);
      const state = url.searchParams.get("state");
      const clientId = url.searchParams.get("client_id");
      assert.ok(url.origin === origin && url.pathname === "/agent/authorize");
      assert.ok(state && clientId && !pending.has(state));
      assert.equal(url.searchParams.get("redirect_uri"), `${callbackOrigin}/callback`);
      const expected = { clientId, received: null };
      pending.set(state, expected);
      return () => {
        assert.ok(expected.received, "Expected client's callback has not arrived");
        return expected.received;
      };
    },
    completed: () => completed,
    async stop() {
      pending.clear();
      await new Promise((done) => {
        listener.close(done);
        listener.closeAllConnections();
      });
    },
  };
}

// Synthetic local proof helper, never included in the application or a client configuration.
export async function prepareAgentAuthorization(name = "Synthetic protocol client") {
  const registration = await fetch(`${origin}/agent/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_name: name,
      redirect_uris: ["http://127.0.0.1:4199/callback"],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    }),
  });
  assert.equal(registration.status, 201);
  const { client_id: clientId } = await registration.json();
  const verifier = randomBytes(32).toString("base64url");
  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: "http://127.0.0.1:4199/callback",
    response_type: "code",
    scope: "atlas:read",
    state: randomBytes(16).toString("base64url"),
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    resource: `${origin}/mcp`,
  });
  return { clientId, verifier, query, url: `${origin}/agent/authorize?${query}` };
}

export async function connectAgent(
  cookie,
  csrf,
  name = "Synthetic protocol client",
  browserConsent,
) {
  const { clientId, verifier, query } = await prepareAgentAuthorization(name);
  let callback;
  if (browserConsent)
    callback = new URL(await browserConsent(`${origin}/agent/authorize?${query}`));
  else {
    const consent = await fetch(`${origin}/agent/authorize?${query}`, {
      headers: { cookie },
      redirect: "manual",
    });
    assert.equal(consent.status, 200);
    const html = await consent.text();
    const id = /name="consent" value="([^"]+)"/u.exec(html)?.[1];
    assert.ok(id);
    const approved = await fetch(`${origin}/agent/authorize`, {
      method: "POST",
      headers: { origin, cookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ consent: id, csrf, decision: "approve" }),
      redirect: "manual",
    });
    assert.equal(approved.status, 303);
    callback = new URL(approved.headers.get("location"));
  }
  assert.equal(callback.searchParams.get("state"), query.get("state"));
  assert.equal(callback.searchParams.get("iss"), origin);
  const codeForm = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    redirect_uri: query.get("redirect_uri"),
    code: callback.searchParams.get("code"),
    code_verifier: verifier,
    resource: `${origin}/mcp`,
  });
  const exchange = (form) =>
    fetch(`${origin}/agent/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form,
    });
  const response = await exchange(codeForm);
  assert.equal(response.status, 200);
  const tokens = await response.json();
  const probe = await fetch(`${origin}/mcp`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${tokens.access_token}`,
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
        clientInfo: { name, version: "1" },
      },
    }),
  });
  assert.equal(probe.status, 200, `Authenticated local protocol probe: ${probe.status}`);
  const client = new Client({ name, version: "1" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), {
      authProvider: { token: async () => tokens.access_token },
    }),
  );
  return { client, tokens, clientId, codeForm, exchange };
}

export async function toolResult(client, name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  assert.notEqual(result.isError, true);
  return JSON.parse(result.content[0].text);
}
