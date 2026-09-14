import { applyD1Migrations, env } from "cloudflare:test";
import { expect, it } from "vitest";
import before from "../migrations/0001_personal_profiles.sql?raw";
import after from "../migrations/0002_agent_credentials.sql?raw";

it("upgrades an occupied C database without preserving old access or losing preferences", async () => {
  const migration = (name: string, sql: string) => ({
    name,
    queries: sql
      .split(";")
      .map((row) => row.trim())
      .filter(Boolean),
  });
  const original = migration("0001", before);
  await applyD1Migrations(env.DB, [original]);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO profiles VALUES (11, 'synthetic-alice', 1, 1)"),
    env.DB.prepare("INSERT INTO sources VALUES ('source-one', 11, 101, 'synthetic/library', 0, 1)"),
    env.DB.prepare(
      "INSERT INTO sessions VALUES ('old-hash', 'old-browser', 11, 'synthetic-ciphertext', 'synthetic-csrf', 'old-policy', 9999999999999, 1)",
    ),
    env.DB.prepare(
      "INSERT INTO oauth_attempts VALUES ('old-state', 'old-browser', 'synthetic-verifier', 9999999999999, 0)",
    ),
  ]);
  await applyD1Migrations(env.DB, [original, migration("0002", after)]);
  expect(
    await env.DB.prepare("SELECT visible FROM sources WHERE user_id = 11").first("visible"),
  ).toBe(0);
  expect(
    await env.DB.prepare("SELECT default_seeded FROM profiles WHERE user_id = 11").first(
      "default_seeded",
    ),
  ).toBe(1);
  for (const table of ["sessions", "credentials", "oauth_attempts", "agent_connections"])
    expect(await env.DB.prepare(`SELECT count(*) AS n FROM ${table}`).first("n")).toBe(0);
});
