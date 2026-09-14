import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import ts from "typescript";
import {
  fixtureControl,
  loginFixture,
  origin,
  startFixture,
  wrangler,
} from "./fixture-runtime.mjs";
import { connectAgent, toolResult } from "./agent-fixture.mjs";

// Local verification only. Production never imports this module or fixture controls.
const reportPath = resolve("proof/runtime/phase-e-http.json");
const commands = [];
const observations = [];
let server;
const agents = [];
async function command(args, config) {
  commands.push({
    executable: process.execPath,
    args: [resolve("node_modules/wrangler/bin/wrangler.js"), ...args, "--config", config],
  });
  return wrangler(args, config);
}
async function start(state, config, status = 200) {
  commands.push({
    executable: process.execPath,
    args: [
      resolve("node_modules/wrangler/bin/wrangler.js"),
      "dev",
      "--local",
      "--persist-to",
      state,
      "--config",
      config,
    ],
    expectedHealth: status,
  });
  return startFixture(state, config, status);
}
const api = (path, cookie = "", method = "GET", body, csrf) =>
  fetch(`${origin}${path}`, {
    method,
    redirect: "manual",
    headers: {
      origin,
      cookie,
      "content-type": "application/json",
      ...(csrf ? { "x-atlas-csrf": csrf } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
async function profile(cookie) {
  const response = await api("/api/profile", cookie);
  assert.equal(response.status, 200);
  return response.json();
}
async function recoveredProfiles() {
  const alice = await loginFixture("alice");
  const bob = await loginFixture("bob");
  const a = await profile(alice.cookie);
  const b = await profile(bob.cookie);
  assert.equal(a.user.id, 11);
  assert.equal(b.user.id, 22);
  assert.equal(a.sources.length, 2);
  assert.equal(b.sources.length, 1);
  assert.equal(
    a.sources.find((row) => row.repository === "fixture-alice/private-skills").visible,
    false,
  );
  assert.equal(b.sources[0].repository, "fixture-operator/public-skills");
  return { alice, bob, a, b };
}
try {
  if (process.argv[2] === "--resume") {
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    server = await start(report.restoredState, report.restoredConfig);
    await recoveredProfiles();
    report.repeatedInstallRecovery =
      "PASS: occupied restored preferences survive repeat npm ci and fresh login";
    report.commands.push(...commands);
    await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ status: "PASS", repeatedSetup: true, report: reportPath }));
  } else {
    await mkdir(dirname(reportPath), { recursive: true });
    const work = await mkdtemp(resolve("proof/runtime/phase-e-"));
    async function configuration(name, template, id, vars = {}) {
      const parsed = ts.parseConfigFileTextToJson(template, await readFile(template, "utf8"));
      assert.equal(parsed.error, undefined);
      const config = parsed.config;
      config.name = `atlas-selfhost-${name}`;
      config.main = resolve(config.main);
      config.assets.directory = resolve(config.assets.directory);
      config.dev = { ip: "127.0.0.1", port: 8790 };
      config.vars = { ...config.vars, ...vars };
      config.d1_databases[0] = {
        ...config.d1_databases[0],
        database_name: `atlas-selfhost-${name}`,
        database_id: `00000000-0000-0000-0000-${String(id).padStart(12, "0")}`,
        migrations_dir: resolve("migrations"),
      };
      config.kv_namespaces[0].id = String(id).padStart(32, "0");
      await mkdir(resolve(work, name));
      const path = resolve(work, name, "wrangler.json");
      await writeFile(path, JSON.stringify(config, null, 2));
      return { path, state: resolve(work, name, ".wrangler/state") };
    }
    const operator = {
      ATLAS_ORIGIN: origin,
      ATLAS_DEPLOYMENT: "self-hosted",
      ATLAS_LOCAL_HTTP: "true",
      ATLAS_ALLOWED_ORG: "",
      ATLAS_ALLOWED_USER_IDS: "11,22",
      ATLAS_DEFAULT_REPOSITORY: "fixture-operator/public-skills",
      GITHUB_CLIENT_ID: "fixture-client-id",
    };
    const unconfigured = await configuration("unconfigured", "wrangler.jsonc", 10);
    server = await start(unconfigured.state, unconfigured.path, 503);
    assert.equal((await api("/api/profile")).status, 503);
    await server.stop();
    server = null;
    const production = await configuration("production", "wrangler.jsonc", 11, operator);
    // Synthetic local values only, written to a config-local secret file, never command arguments.
    await writeFile(
      resolve(dirname(production.path), ".dev.vars"),
      `GITHUB_CLIENT_SECRET=fixture-client-secret\nATLAS_ENCRYPTION_KEY=${Buffer.from("0123456789abcdef0123456789abcdef").toString("base64")}\n`,
      { mode: 0o600 },
    );
    await command(
      ["d1", "migrations", "apply", "DB", "--local", "--persist-to", production.state],
      production.path,
    );
    server = await start(production.state, production.path);
    assert.equal((await fetch(origin)).status, 200);
    assert.equal((await api("/api/profile")).status, 401);
    assert.equal((await api("/__fixture/control", "", "POST", {})).status, 405);
    await server.stop();
    server = null;
    observations.push(
      "Production entrypoint fails closed without configuration; configured/migrated health and assets serve locally, anonymous private access and fixture controls are denied. No provider request or live login is claimed.",
    );

    const fixture = await configuration("fixture", "wrangler.fixture.jsonc", 12, operator);
    const restored = await configuration("restored", "wrangler.fixture.jsonc", 13, operator);
    await command(
      ["d1", "migrations", "apply", "DB", "--local", "--persist-to", fixture.state],
      fixture.path,
    );
    server = await start(fixture.state, fixture.path);
    for (const user of ["alice", "bob"])
      await fixtureControl("control", { user, membership: "absent" });
    const alice = await loginFixture("alice");
    const bob = await loginFixture("bob");
    const denied = await loginFixture("nonmember");
    assert.equal(denied.cookie, "");
    const a = await profile(alice.cookie);
    const b = await profile(bob.cookie);
    for (const value of [a, b]) {
      assert.equal(value.sources.length, 1);
      assert.equal(value.sources[0].repository, operator.ATLAS_DEFAULT_REPOSITORY);
    }
    const defaultResponse = await api(`/api/sources/${a.sources[0].id}`, alice.cookie);
    const defaultSource = await defaultResponse.json();
    assert.equal(defaultSource.pack.repositoryId, 102);
    const agent = await connectAgent(alice.cookie, a.csrfToken, "Synthetic independent operator");
    agents.push(agent);
    const read = await toolResult(agent.client, "read_skill", {
      sourceId: a.sources[0].id,
      skillId: defaultSource.pack.skills[0].id,
    });
    assert.equal(read.sha, defaultSource.pack.revision);
    assert.equal(read.skillId, defaultSource.pack.skills[0].id);
    assert.match(read.markdown, /PUBLIC SYNTHETIC OPERATOR DEFAULT/u);
    observations.push(
      "Numeric allowlist admits two users with no organization membership, denies an unlisted user, and seeds the changed public default. Actual HTTP and standard MCP agree on its skill ID/SHA/body.",
    );
    const imported = await api(
      "/api/sources",
      alice.cookie,
      "POST",
      { repository: "fixture-alice/private-skills" },
      a.csrfToken,
    );
    assert.equal(imported.status, 200);
    const source = await imported.json();
    const sourcePath = `/api/sources/${source.source.id}`;
    assert.equal((await api(sourcePath, bob.cookie)).status, 404);
    assert.equal(
      (await api(sourcePath, alice.cookie, "PATCH", { visible: false }, a.csrfToken)).status,
      200,
    );
    const duplicate = await api(
      "/api/sources",
      alice.cookie,
      "POST",
      { repository: "fixture-alice/private-skills" },
      a.csrfToken,
    );
    assert.equal((await duplicate.json()).source.visible, false);
    await server.stop();
    server = null;
    const repeat = await command(
      ["d1", "migrations", "apply", "DB", "--local", "--persist-to", fixture.state],
      fixture.path,
    );
    assert.match(repeat, /No migrations to apply/iu);
    server = await start(fixture.state, fixture.path);
    assert.equal((await profile(alice.cookie)).sources.length, 2);
    assert.equal((await profile(bob.cookie)).sources.length, 1);
    assert.equal((await toolResult(agent.client, "connection_identity")).user.id, 11);
    await server.stop();
    server = null;
    observations.push(
      "Duplicate setup/import and occupied migration replay preserve hidden preferences and separate profiles; browser and agent state survive process restart.",
    );
    const backup = resolve(work, "synthetic-backup.sql");
    await command(["d1", "export", "DB", "--local", "--output", backup], fixture.path);
    assert.doesNotMatch(
      await readFile(backup, "utf8"),
      /PRIVATE ALICE SYNTHETIC CONTENT|fixture-user-token|fixture-client-secret/u,
    );
    await command(
      ["d1", "execute", "DB", "--local", "--persist-to", restored.state, "--file", backup],
      restored.path,
    );
    await command(
      [
        "d1",
        "execute",
        "DB",
        "--local",
        "--persist-to",
        restored.state,
        "--command",
        "DELETE FROM agent_consents; DELETE FROM agent_connections; DELETE FROM sessions; DELETE FROM credentials; DELETE FROM oauth_attempts; DELETE FROM agent_refresh_uses;",
      ],
      restored.path,
    );
    await command(
      ["d1", "migrations", "apply", "DB", "--local", "--persist-to", restored.state],
      restored.path,
    );
    server = await start(restored.state, restored.path);
    assert.equal((await api("/api/profile", alice.cookie)).status, 401);
    assert.equal((await api("/api/profile", bob.cookie)).status, 401);
    assert.equal(
      (
        await fetch(`${origin}/mcp`, {
          headers: { authorization: `Bearer ${agent.tokens.access_token}` },
        })
      ).status,
      401,
    );
    const recovered = await recoveredProfiles();
    const newAgent = await connectAgent(
      recovered.alice.cookie,
      recovered.a.csrfToken,
      "Synthetic recovered operator",
    );
    agents.push(newAgent);
    assert.equal((await toolResult(newAgent.client, "connection_identity")).user.id, 11);
    observations.push(
      "SQL restore into another D1 ID/state and fresh independent KV denies both old cookies and the old agent token after invalidation. Fresh browser/agent access recovers the same profiles and hidden preferences. D's separate retained-KV regression covers stale KV denial.",
    );
    await writeFile(
      reportPath,
      JSON.stringify(
        {
          status: "PASS",
          syntheticOnly: true,
          work,
          fixtureConfig: fixture.path,
          restoredConfig: restored.path,
          restoredState: restored.state,
          operator,
          commands,
          observations,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      JSON.stringify({ status: "PASS", checks: observations.length, report: reportPath }),
    );
  }
} finally {
  await Promise.allSettled([...agents.map((agent) => agent.client.close()), server?.stop()]);
}
