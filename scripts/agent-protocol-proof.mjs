import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { origin, wrangler, startFixture, loginFixture } from "./fixture-runtime.mjs";
import {
  connectAgent,
  prepareAgentAuthorization,
  startAgentCallback,
  toolResult,
} from "./agent-fixture.mjs";

await mkdir("proof/runtime", { recursive: true });
const work = await mkdtemp(resolve("proof/runtime/phase-d-"));
const state = resolve(work, "state");
let server;
let agent;
let callbackListener;
const observations = [];
try {
  await wrangler(["d1", "migrations", "apply", "DB", "--local", "--persist-to", state]);
  server = await startFixture(state);
  callbackListener = await startAgentCallback();
  await assert.rejects(() => startAgentCallback(), /listener unavailable/u);
  const callbackRequest = await prepareAgentAuthorization("Synthetic listener probe");
  const received = callbackListener.expect(callbackRequest.url);
  const callback = new URL(callbackRequest.query.get("redirect_uri"));
  callback.searchParams.set("state", "unexpected");
  callback.searchParams.set("iss", origin);
  callback.searchParams.set("code", "synthetic-probe-only");
  assert.equal((await fetch(callback)).status, 400);
  callback.searchParams.set("state", callbackRequest.query.get("state"));
  assert.equal((await fetch(callback)).status, 200);
  assert.equal(received(), callback.href);
  assert.equal((await fetch(callback)).status, 400);
  await callbackListener.stop();
  callbackListener = null;
  observations.push(
    "Real loopback callback listener rejects port takeover, unknown state and replay; expected client state is accepted once, with callback values kept only in memory.",
  );
  const discovery = await (
    await fetch(`${origin}/.well-known/oauth-protected-resource/mcp`)
  ).json();
  assert.equal(discovery.resource, `${origin}/mcp`, JSON.stringify(discovery));
  const issuer = await (await fetch(`${origin}/.well-known/oauth-authorization-server`)).json();
  assert.equal(issuer.issuer, origin);
  const alice = await loginFixture("alice");
  const browser = await (
    await fetch(`${origin}/api/profile`, { headers: { cookie: alice.cookie } })
  ).json();
  agent = await connectAgent(alice.cookie, browser.csrfToken);
  assert.deepEqual(
    (await agent.client.listTools()).tools.map((tool) => tool.name),
    ["connection_identity", "list_sources", "search_skills", "read_skill", "read_relations"],
  );
  const identity = await toolResult(agent.client, "connection_identity");
  assert.equal(identity.user.id, 11);
  const sourceId = browser.sources[0].id;
  const source = await (
    await fetch(`${origin}/api/sources/${sourceId}`, { headers: { cookie: alice.cookie } })
  ).json();
  const skill = await toolResult(agent.client, "read_skill", {
    sourceId,
    skillId: source.pack.skills[0].id,
  });
  assert.equal(skill.sha, source.pack.revision);
  assert.equal(skill.skillId, source.pack.skills[0].id);
  assert.equal(new URL(skill.url).searchParams.get("source"), sourceId);
  assert.ok(!skill.url.includes("token"));
  observations.push(
    "Actual local HTTP discovery, S256 consent/code exchange, standard SDK initialization/list/read, same browser ID/SHA and token-free deep link pass.",
  );
  await fetch(`${origin}/api/session`, {
    method: "DELETE",
    headers: { origin, cookie: alice.cookie, "x-atlas-csrf": browser.csrfToken },
  });
  assert.equal((await toolResult(agent.client, "connection_identity")).user.id, 11);
  const refresh = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: agent.clientId,
    refresh_token: agent.tokens.refresh_token,
    resource: `${origin}/mcp`,
  });
  const refreshed = await agent.exchange(refresh);
  assert.equal(refreshed.status, 200);
  const freshTokens = await refreshed.json();
  assert.equal((await agent.exchange(refresh)).status, 400);
  assert.equal(
    (
      await fetch(`${origin}/mcp`, {
        headers: { authorization: `Bearer ${freshTokens.access_token}` },
      })
    ).status,
    405,
  );
  observations.push(
    "Browser logout preserves independently consented access; Atlas refresh rotates once and replay is denied.",
  );
  await agent.client.close();
  await server.stop();
  server = null;
  // Restore invalidation runs with the provider's existing KV deliberately retained.
  await wrangler([
    "d1",
    "execute",
    "DB",
    "--local",
    "--persist-to",
    state,
    "--command",
    "DELETE FROM agent_consents; DELETE FROM agent_connections; DELETE FROM sessions; DELETE FROM credentials; DELETE FROM oauth_attempts; DELETE FROM agent_refresh_uses;",
  ]);
  server = await startFixture(state);
  const stale = await fetch(`${origin}/mcp`, {
    headers: { authorization: `Bearer ${freshTokens.access_token}` },
  });
  assert.equal(stale.status, 401);
  assert.equal((await agent.exchange(agent.codeForm)).status, 400);
  observations.push(
    "Recovery invalidation rejects a still-present KV token after Worker restart; no provider token or skill body is persisted in the report.",
  );
  await writeFile(
    "proof/runtime/phase-d-protocol.json",
    JSON.stringify({ status: "PASS", origin, syntheticOnly: true, observations }, null, 2),
  );
  console.log(
    JSON.stringify({
      status: "PASS",
      checks: observations.length,
      report: "proof/runtime/phase-d-protocol.json",
    }),
  );
} finally {
  await Promise.allSettled([agent?.client.close(), server?.stop(), callbackListener?.stop()]);
}
