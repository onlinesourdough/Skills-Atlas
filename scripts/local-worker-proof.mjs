import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  cookieJar,
  fixtureControl,
  loginFixture,
  origin,
  startFixture,
  wrangler,
} from "./fixture-runtime.mjs";

await mkdir("proof/runtime", { recursive: true });
const work = await mkdtemp(resolve("proof/runtime/phase-c-"));
const state = resolve(work, ".wrangler/state");
const restored = resolve(work, "restored");
const backup = resolve(work, "fixture-backup.sql");
const exportConfig = resolve(work, "wrangler.json");
await writeFile(
  exportConfig,
  JSON.stringify({
    name: "atlas-fixture-export",
    compatibility_date: "2026-09-08",
    send_metrics: false,
    d1_databases: [
      {
        binding: "DB",
        database_name: "atlas-fixture",
        database_id: "00000000-0000-0000-0000-000000000001",
      },
    ],
  }),
);
const observations = [];
let server;
const api = (path, cookie, method = "GET", body, csrf) =>
  fetch(`${origin}${path}`, {
    method,
    headers: {
      origin,
      cookie,
      "content-type": "application/json",
      ...(csrf ? { "x-atlas-csrf": csrf } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: "manual",
  });
async function profile(cookie) {
  const response = await api("/api/profile", cookie);
  assert.equal(response.status, 200);
  return response.json();
}
try {
  await wrangler(["d1", "migrations", "apply", "DB", "--local", "--persist-to", state]);
  const repeat = await wrangler([
    "d1",
    "migrations",
    "apply",
    "DB",
    "--local",
    "--persist-to",
    state,
  ]);
  assert.match(repeat, /No migrations to apply/i);
  server = await startFixture(state);
  assert.equal((await fetch(origin)).status, 200);
  assert.equal((await api("/api/profile", "")).status, 401);
  for (const user of ["pending", "nonmember", "outside"]) {
    const denied = await loginFixture(user);
    assert.equal(denied.cookie, "");
    assert.match(denied.response.headers.get("location"), /authError=/);
  }
  observations.push(
    "Local migrations apply and replay cleanly; built UI/health serve; anonymous and three disallowed accounts fail closed.",
  );
  const alice = await loginFixture("alice");
  const bob = await loginFixture("bob");
  const a = await profile(alice.cookie);
  const b = await profile(bob.cookie);
  assert.equal(a.user.id, 11);
  assert.equal(b.user.id, 22);
  const imported = await api(
    "/api/sources",
    alice.cookie,
    "POST",
    { repository: "fixture-alice/private-skills" },
    a.csrfToken,
  );
  assert.equal(imported.status, 200);
  const source = await imported.json();
  const path = `/api/sources/${source.source.id}`;
  assert.match(JSON.stringify(source.pack), /PRIVATE ALICE SYNTHETIC CONTENT/);
  assert.equal(source.pack.access, "read");
  assert.equal((await api(path, bob.cookie)).status, 404);
  assert.equal(
    (await api(path, alice.cookie, "PATCH", { visible: false }, a.csrfToken)).status,
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
  assert.equal((await profile(alice.cookie)).sources.length, 2);
  observations.push(
    "Two user identities stay isolated; duplicate import preserves a hidden source and read-only access.",
  );
  await server.stop();
  server = await startFixture(state);
  const afterRestart = await profile(alice.cookie);
  assert.equal(afterRestart.sources.find((item) => item.id === source.source.id).visible, false);
  assert.equal((await profile(bob.cookie)).sources.length, 1);
  observations.push(
    "Worker restart retains encrypted session and independent source choices in local D1.",
  );
  await server.stop();
  server = null;
  await wrangler(["d1", "export", "DB", "--local", "--output", backup], exportConfig);
  const sql = await readFile(backup, "utf8");
  assert.doesNotMatch(
    sql,
    /PRIVATE ALICE SYNTHETIC CONTENT|fixture-user-token|fixture-client-secret/,
  );
  await wrangler(["d1", "execute", "DB", "--local", "--persist-to", restored, "--file", backup]);
  await wrangler([
    "d1",
    "execute",
    "DB",
    "--local",
    "--persist-to",
    restored,
    "--command",
    "DELETE FROM agent_consents; DELETE FROM agent_connections; DELETE FROM sessions; DELETE FROM credentials; DELETE FROM oauth_attempts; DELETE FROM agent_refresh_uses;",
  ]);
  await wrangler(["d1", "migrations", "apply", "DB", "--local", "--persist-to", restored]);
  server = await startFixture(restored);
  assert.equal((await api("/api/profile", alice.cookie)).status, 401);
  const again = await loginFixture("alice");
  const recovered = await profile(again.cookie);
  assert.equal(recovered.user.id, 11);
  assert.equal(recovered.sources.find((item) => item.id === source.source.id).visible, false);
  observations.push(
    "SQL export/import into independent local D1 restores preferences; clearing session/flow tables prevents old-cookie replay; re-login recovers the same numeric profile.",
  );
  await fixtureControl("control", { repositoryId: 201, users: [] });
  assert.equal((await api(path, again.cookie)).status, 404);
  assert.equal(
    (await profile(again.cookie)).sources.find((item) => item.id === source.source.id).available,
    false,
  );
  await fixtureControl("control", { user: "alice", revoked: true });
  assert.equal((await api("/api/profile", again.cookie)).status, 401);
  const logout = await api("/api/session", again.cookie, "DELETE", undefined, recovered.csrfToken);
  assert.equal(logout.status, 200);
  assert.equal(cookieJar(logout, again.cookie), "");
  observations.push(
    "Repository removal and token revocation fail closed after restore; logout still clears the cookie with a revoked provider token.",
  );
  await writeFile(
    "proof/runtime/phase-c-http.json",
    JSON.stringify({ status: "PASS", observations, fixtureOnly: true }, null, 2) + "\n",
  );
  console.log(JSON.stringify({ status: "PASS", observations }, null, 2));
} finally {
  await server?.stop();
}
