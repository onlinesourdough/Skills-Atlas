import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, lstat, mkdir, mkdtemp, readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve, sep } from "node:path";
import { arch, platform, release, tmpdir } from "node:os";

// Verification driver, not an installer. All development remains in the source repository.
const source = await realpath(resolve(new URL("..", import.meta.url).pathname));
const [mode, supplied] = process.argv.slice(2);
assert.ok([undefined, "--browser", "--sync-docs"].includes(mode), "Unsupported proof mode");
const git = (...args) => execFileSync("git", args, { cwd: source, encoding: "utf8" }).trim();
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const excluded = (path) =>
  /^(?:\.git|node_modules|dist|\.wrangler|proof|\.playwright-cli)(?:\/|$)/u.test(path) ||
  (/(?:^|\/)\.(?:env|dev\.vars)(?:\.|$)/u.test(path) &&
    ![".env.example", ".dev.vars.example"].includes(path)) ||
  /(?:^|\/)(?:\.npmrc|\.DS_Store)$/u.test(path);
async function manifest() {
  const paths = [
    ...new Set([...git("ls-files", "--cached", "--others", "--exclude-standard").split("\n")]),
  ]
    .filter((path) => path && !excluded(path))
    .sort();
  const rows = [];
  for (const path of paths) {
    const absolute = resolve(source, path);
    const info = await lstat(absolute).catch((error) => {
      if (error.code !== "ENOENT") throw error;
      return null;
    });
    if (!info) continue; // Tracked deletions are absent from the distributable source.
    const target = await realpath(absolute);
    assert.ok(target.startsWith(`${source}${sep}`), "Package path escapes repository");
    assert.ok(info.isFile() || info.isSymbolicLink(), "Unsupported package entry");
    // Safe in-repository file links are materialized, never followed into owner state.
    const bytes = await readFile(target);
    rows.push({ path, bytes: bytes.length, sha256: sha(bytes) });
  }
  return rows;
}
async function verify(root, rows) {
  const copied = [];
  for (const row of rows) {
    const bytes = await readFile(resolve(root, row.path));
    const actual = { path: row.path, bytes: bytes.length, sha256: sha(bytes) };
    assert.deepEqual(actual, row, `Snapshot mismatch: ${row.path}`);
    copied.push(actual);
  }
  return sha(JSON.stringify(copied));
}
const work = supplied
  ? await realpath(supplied)
  : await realpath(await mkdtemp(resolve(tmpdir(), "atlas-selfhost-")));
assert.ok(
  isAbsolute(work) && !work.startsWith(source) && !work.split(sep).includes(".AIOS"),
  "Snapshot must be outside AIOS/repository",
);
const destination = resolve(work, "source");
const reportPath = resolve(work, "report.json");
let report = supplied
  ? JSON.parse(await readFile(reportPath, "utf8"))
  : { status: "RUNNING", source, destination, startedAt: new Date().toISOString(), commands: [] };
assert.equal(report.destination, destination);
const npm = await realpath(execFileSync("which", ["npm"], { encoding: "utf8" }).trim());
const isolated = resolve(work, "isolated");
await mkdir(isolated, { recursive: true });
for (const name of ["npm-user.ini", "npm-global.ini"])
  await writeFile(resolve(isolated, name), "registry=https://registry.npmjs.org/\n");
const environment = {
  PATH: [dirname(process.execPath), "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(":"),
  LANG: "en_US.UTF-8",
  CI: "true",
  TMPDIR: work,
  ...(process.env.HOME ? { HOME: process.env.HOME } : {}),
  ...(process.env.CODEX_HOME ? { CODEX_HOME: process.env.CODEX_HOME } : {}),
  XDG_CONFIG_HOME: resolve(isolated, "config"),
  npm_config_userconfig: resolve(isolated, "npm-user.ini"),
  npm_config_globalconfig: resolve(isolated, "npm-global.ini"),
  npm_config_cache: resolve(isolated, "npm-cache"),
  WRANGLER_SEND_METRICS: "false",
  WRANGLER_LOG_PATH: resolve(isolated, "wrangler-logs"),
  WRANGLER_REGISTRY_PATH: resolve(isolated, "wrangler-registry"),
};
async function run(args, extra = {}) {
  const index = report.commands.length + 1;
  const log = resolve(work, `command-${String(index).padStart(2, "0")}.log`);
  const record = {
    cwd: destination,
    executable: process.execPath,
    nodeVersion: process.version,
    args,
    log,
    startedAt: new Date().toISOString(),
  };
  report.commands.push(record);
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify({ step: index, command: args[0] === npm ? ["npm", ...args.slice(1)] : args }),
  );
  const result = await new Promise((done, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: destination,
      env: { ...environment, ...extra },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    child.once("error", reject);
    child.once("exit", (code) => done({ code, output }));
  });
  await writeFile(log, result.output, { mode: 0o600 });
  record.exitCode = result.code;
  record.finishedAt = new Date().toISOString();
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
  assert.equal(result.code, 0, `Snapshot step ${index} failed; inspect its local log`);
}
try {
  if (!mode) {
    assert.equal(git("rev-parse", "--show-toplevel"), source);
    const rows = await manifest();
    await mkdir(destination);
    for (const row of rows) {
      await mkdir(dirname(resolve(destination, row.path)), { recursive: true });
      await copyFile(resolve(source, row.path), resolve(destination, row.path));
    }
    report.copiedManifestSha256 = await verify(destination, rows);
    for (const name of ["node_modules", "dist", ".git", ".wrangler", "proof"])
      assert.equal(await lstat(resolve(destination, name)).catch(() => null), null);
    report.noInheritedRuntimeState = true;
    report.baseline = { branch: git("branch", "--show-current"), head: git("rev-parse", "HEAD") };
    report.manifest = rows;
    report.manifestSha256 = sha(JSON.stringify(rows));
    report.initialManifestSha256 = report.manifestSha256;
    report.runtime = {
      cwd: destination,
      node: process.execPath,
      nodeVersion: process.version,
      npm,
      npmVersion: execFileSync(process.execPath, [npm, "--version"], {
        env: environment,
        encoding: "utf8",
      }).trim(),
      platform: platform(),
      release: release(),
      architecture: arch(),
    };
    report.environment = {
      keys: Object.keys(environment).sort(),
      inheritedAccountSecrets: false,
      homeValuesUnchanged: true,
      isolatedConfiguration: isolated,
    };
    await writeFile(resolve(work, "manifest.json"), JSON.stringify(rows, null, 2) + "\n");
    await run([npm, "ci"]);
    for (const command of ["check", "docs:check", "security:check"])
      await run([npm, "run", command]);
    await run([npm, "audit", "--audit-level=high"]);
    await run([npm, "audit", "--omit=dev", "--audit-level=high"]);
    await run(["scripts/selfhost-proof.mjs"]);
    await run(["scripts/agent-protocol-proof.mjs"]);
    await run(["scripts/local-worker-proof.mjs"]);
    await run([npm, "ci"]);
    await run(["scripts/selfhost-proof.mjs", "--resume"]);
    const notices = [
      ["mcp-server-2.0.0.txt", "@modelcontextprotocol/server/LICENSE"],
      ["mcp-core-2.0.0.txt", "@modelcontextprotocol/core/LICENSE"],
      ["workers-oauth-provider-0.10.3.txt", "@cloudflare/workers-oauth-provider/LICENSE.txt"],
      ["zod-4.5.4.txt", "zod/LICENSE"],
    ];
    for (const [name, upstream] of notices) {
      const expected = sha(await readFile(resolve(destination, "node_modules", upstream)));
      for (const folder of [
        "public",
        "dist/client",
        "dist/static",
        "dist/worker-client",
        "dist/worker",
      ])
        assert.equal(
          sha(await readFile(resolve(destination, folder, "third-party", name))),
          expected,
        );
    }
    report.notices = "PASS: 20 byte-for-byte upstream/source/artifact notice comparisons";
    await verify(destination, rows);
    report.status = "LOCAL_PASS_BROWSER_PENDING";
  } else {
    await verify(destination, report.manifest);
    if (mode === "--browser") {
      const proof = JSON.parse(
        await readFile(resolve(destination, "proof/runtime/phase-e-http.json"), "utf8"),
      );
      await run([npm, "run", "browser:agent"], { ATLAS_FIXTURE_CONFIG: proof.fixtureConfig });
      await run([npm, "run", "browser:personal"]);
      await run([npm, "run", "browser:proof"]);
      report.browser =
        "PASS: all three local browser suites; synthetic policy/default, consent and private MCP handoff";
      report.status = "LOCAL_PASS";
      report.limits =
        "Local synthetic provider and headless browser proof only; native Codex zoom, live GitHub installation/private access, real Codex connection and Ship remain unverified.";
    } else {
      const rows = await manifest();
      const runtime = (rows) =>
        rows.filter((row) => row.path !== "README.md" && !row.path.startsWith("docs/"));
      assert.deepEqual(
        runtime(rows),
        runtime(report.manifest),
        "Runtime changed; create and verify a new snapshot",
      );
      for (const row of rows.filter(
        (row) => row.path === "README.md" || row.path.startsWith("docs/"),
      )) {
        await mkdir(dirname(resolve(destination, row.path)), { recursive: true });
        await copyFile(resolve(source, row.path), resolve(destination, row.path));
      }
      report.copiedManifestSha256 = await verify(destination, rows);
      report.manifest = rows;
      report.manifestSha256 = sha(JSON.stringify(rows));
      await writeFile(resolve(work, "manifest.json"), JSON.stringify(rows, null, 2) + "\n");
      await run([npm, "run", "docs:check"]);
      await run([npm, "run", "security:check"]);
    }
  }
  report.finishedAt = new Date().toISOString();
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify({
      status: report.status,
      snapshot: work,
      manifestSha256: report.manifestSha256,
      report: reportPath,
    }),
  );
} catch (error) {
  report.status = "FAIL";
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
  throw error;
}
