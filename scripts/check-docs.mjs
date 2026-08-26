import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const errors = [];

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if ([".git", "node_modules", "dist", "proof"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await markdownFiles(path)));
    else if (entry.isFile() && extname(entry.name).toLowerCase() === ".md") files.push(path);
  }
  return files;
}

const linkPattern = /\[[^\]]+\]\(([^)]+)\)/gu;
for (const file of await markdownFiles(root)) {
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(linkPattern)) {
    const raw = match[1]?.trim().replace(/^<|>$/gu, "");
    if (!raw || raw.startsWith("#") || /^(?:https?:|mailto:)/u.test(raw)) continue;
    const target = raw.split("#", 1)[0]?.split("?", 1)[0];
    if (!target || target.startsWith("/")) continue;
    const resolved = resolve(dirname(file), target);
    try {
      await stat(resolved);
    } catch {
      errors.push(`${file.replace(`${root}/`, "")}: missing ${target}`);
    }
  }
}

if (errors.length) {
  for (const error of errors) console.error(`FAIL ${error}`);
  process.exitCode = 1;
} else {
  console.log("PASS documentation local links");
}
