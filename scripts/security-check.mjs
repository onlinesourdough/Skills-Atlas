import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);
const patterns = [
  ["private-key", /-----BEGIN [A-Z ]+ PRIVATE KEY-----/u],
  ["openai-token-prefix", /\bsk-[A-Za-z0-9_-]{20,}/u],
  ["github-token-prefix", /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_-]{20,}/u],
  ["aws-access-key", /\bAKIA[0-9A-Z]{16}\b/u],
  ["slack-token-prefix", /\bxox[baprs]-[A-Za-z0-9-]{20,}/u],
  ["bearer-token", /\bBearer[ \t]+[A-Za-z0-9._~+/=-]{24,}/u],
  ["owner-local-path", /\/Users\/[A-Za-z0-9._-]+(?:\/|$)/u],
];
const findings = [];

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if ([".git", "node_modules", "dist", "proof"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await files(path)));
    else if (entry.isFile() && textExtensions.has(extname(entry.name).toLowerCase()))
      result.push(path);
  }
  return result;
}

for (const path of await files(root)) {
  const lines = (await readFile(path, "utf8")).split("\n");
  lines.forEach((line, index) => {
    for (const [kind, pattern] of patterns) {
      if (pattern.test(line)) findings.push(`${kind} ${relative(root, path)}:${index + 1}`);
    }
    const action = line.match(/^\s*uses:\s+([^#\s]+)/u)?.[1];
    if (
      action &&
      !action.startsWith("./") &&
      !action.startsWith("docker://") &&
      !/@[0-9a-f]{40}$/u.test(action)
    ) {
      findings.push(`mutable-action ${relative(root, path)}:${index + 1}`);
    }
  });
}

if (findings.length) {
  for (const finding of findings) console.error(`MATCH ${finding}`);
  console.error(`FAIL security finding count=${findings.length} (values withheld)`);
  process.exitCode = 1;
} else {
  console.log(
    "PASS security scan: no known secret or publish-safety markers; workflow actions use immutable refs",
  );
}
