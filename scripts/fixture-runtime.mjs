import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

export const origin = "http://127.0.0.1:8790";
const cli = resolve("node_modules/wrangler/bin/wrangler.js");
export const fixtureConfig = process.env.ATLAS_FIXTURE_CONFIG ?? "wrangler.fixture.jsonc";
const environment = {
  ...process.env,
  WRANGLER_SEND_METRICS: "false",
  WRANGLER_LOG_PATH: resolve("proof/runtime/wrangler-logs"),
  WRANGLER_REGISTRY_PATH: resolve("proof/runtime/wrangler-registry"),
  XDG_CONFIG_HOME: resolve("proof/runtime/wrangler-config"),
};
// Never pass ambient provider credentials into the synthetic local runtime.
for (const name of [
  "GITHUB_TOKEN",
  "GITHUB_CLIENT_SECRET",
  "ATLAS_ENCRYPTION_KEY",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_API_KEY",
])
  delete environment[name];

export async function wrangler(args, configPath = fixtureConfig) {
  await mkdir("proof/runtime", { recursive: true });
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [cli, ...args, "--config", configPath], {
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (data) => {
      output += String(data);
    });
    child.stderr.on("data", (data) => {
      output += String(data);
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolvePromise(output)
        : reject(new Error(`Local Wrangler failed (${code}): ${output}`)),
    );
  });
}

export async function startFixture(persist, configPath = fixtureConfig, healthStatus = 200) {
  // Refuse to take over an existing server or attach the proof to unknown state.
  try {
    await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(300) });
    throw new Error("Fixture port is already in use");
  } catch (error) {
    if (error.message === "Fixture port is already in use") throw error;
  }
  const child = spawn(
    process.execPath,
    [cli, "dev", "--local", "--persist-to", persist, "--config", configPath],
    { env: environment, stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  child.stdout.on("data", (data) => {
    output += String(data);
  });
  child.stderr.on("data", (data) => {
    output += String(data);
  });
  const stop = async () => {
    if (child.exitCode !== null) return;
    await new Promise((done) => {
      child.once("exit", done);
      child.kill("SIGTERM");
    });
  };
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Fixture exited: ${output}`);
    try {
      const health = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(300) });
      if (health.status === healthStatus) return { stop };
    } catch {
      /* The local listener is still starting. */
    }
    await new Promise((done) => setTimeout(done, 100));
  }
  await stop();
  throw new Error(`Fixture did not become healthy: ${output}`);
}

export async function fixtureControl(path, body) {
  const response = await fetch(`${origin}/__fixture/${path}`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Fixture control failed: ${response.status}`);
  return response.json();
}

export function cookieJar(response, previous = "") {
  const values = new Map(
    previous
      .split("; ")
      .filter(Boolean)
      .map((item) => [item.split("=")[0], item]),
  );
  for (const value of response.headers.getSetCookie()) {
    const entry = value.split(";")[0];
    const name = entry.split("=")[0];
    if (value.includes("Max-Age=0")) values.delete(name);
    else values.set(name, entry);
  }
  return [...values.values()].join("; ");
}

export async function loginFixture(user) {
  const begin = await fetch(`${origin}/auth/github/login`, {
    method: "POST",
    headers: { origin },
    redirect: "manual",
  });
  if (begin.status !== 303) throw new Error("Local OAuth start failed");
  const { callback } = await fixtureControl("authorize", {
    user,
    url: begin.headers.get("location"),
  });
  const end = await fetch(callback, { headers: { cookie: cookieJar(begin) }, redirect: "manual" });
  return { response: end, cookie: cookieJar(end, cookieJar(begin)) };
}
