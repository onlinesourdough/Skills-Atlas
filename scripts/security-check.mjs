import { readdir, readFile, stat } from "node:fs/promises";
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

async function requiredText(path, label) {
  try {
    return await readFile(join(root, path), "utf8");
  } catch {
    findings.push(`missing-${label} ${path}`);
    return "";
  }
}

async function files(directory, excludedDirectories = new Set()) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if (excludedDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await files(path, excludedDirectories)));
    else if (entry.isFile() && textExtensions.has(extname(entry.name).toLowerCase()))
      result.push(path);
  }
  return result;
}

const sourceFiles = await files(root, new Set([".git", "node_modules", "dist", "proof"]));
for (const path of sourceFiles) {
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

const packageSource = await requiredText("package.json", "package-metadata");
try {
  const packageMetadata = JSON.parse(packageSource);
  if (packageMetadata.private !== true) findings.push("npm-publication-guard package.json");
  if (packageMetadata.license !== "MIT") findings.push("license-metadata package.json");
} catch {
  findings.push("invalid-package-metadata package.json");
}

const cname = (await requiredText("public/CNAME", "cname")).trim();
if (cname !== "skills.onlinesourdough.com") findings.push("invalid-cname public/CNAME");

const readme = await requiredText("README.md", "readme");
for (const target of [
  "https://skills.onlinesourdough.com",
  "https://github.com/onlinesourdough/Skills",
  "https://github.com/onlinesourdough/Skills-Atlas",
  "https://github.com/onlinesourdough/Skills-Atlas/issues",
]) {
  if (!readme.includes(target)) findings.push("missing-release-link README.md");
}
await requiredText("CONTRIBUTING.md", "contributing-policy");
const disclosure = await requiredText("SECURITY.md", "security-policy");
if (!disclosure.includes("/security/advisories/new")) {
  findings.push("missing-private-disclosure SECURITY.md");
}

const staticRoot = join(root, "dist", "static");
try {
  if (!(await stat(staticRoot)).isDirectory()) throw new Error("not-directory");
} catch {
  findings.push("static-artifact dist/static is missing; run npm run build:static");
}

const staticPatterns = [
  ...patterns,
  ["failed-fetch-output", /curl:[ \t]*\(56\)/iu],
  ["observed-private-revision", /c09f5ca[a-f0-9]*/iu],
];

if (findings.length === 0 || (await stat(staticRoot).catch(() => null))?.isDirectory()) {
  for (const path of await files(staticRoot).catch(() => [])) {
    const lines = (await readFile(path, "utf8")).split("\n");
    lines.forEach((line, index) => {
      for (const [kind, pattern] of staticPatterns) {
        if (pattern.test(line)) {
          findings.push(`static-${kind} ${relative(root, path)}:${index + 1}`);
        }
      }
    });
  }
}

if (findings.length) {
  for (const finding of findings) console.error(`MATCH ${finding}`);
  console.error(`FAIL security finding count=${findings.length} (values withheld)`);
  process.exitCode = 1;
} else {
  console.log(
    "PASS security scan: source and static artifact contain no known secret, owner-path, failed-fetch, or withheld-revision markers; workflow actions use immutable refs",
  );
}
