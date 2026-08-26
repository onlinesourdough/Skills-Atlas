import { lstat, readdir, readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { BUNDLED_SKILLS } from "../src/data/bundled-skills.js";
import {
  MAX_SKILL_BYTES,
  parseSkillMarkdown,
  SkillParseError,
} from "../src/domain/skill-parser.js";
import type { AtlasSkill, AtlasSnapshot, GraphTone } from "../src/types.js";

export const MAX_SKILLS = 100;
export const READ_TIMEOUT_MS = 1500;

export type SourceErrorCode =
  | "invalid-root"
  | "missing-skills-directory"
  | "unsafe-symlink"
  | "unsafe-path"
  | "too-many-skills"
  | "empty-source"
  | "file-too-large"
  | "invalid-skill"
  | "read-failed"
  | "read-timeout";

export class SourceError extends Error {
  readonly code: SourceErrorCode;

  constructor(code: SourceErrorCode) {
    super(code);
    this.name = "SourceError";
    this.code = code;
  }
}

const CATEGORY_BY_SLUG: Record<string, string> = {
  clarify: "Shape the work",
  "manage-skills": "Govern the shelf",
  "route-models": "Route responsibly",
  "source-audit": "Govern the shelf",
  "proof-loop": "Prove the result",
  "risk-check": "Prove the result",
  "release-notes": "Distribute the work",
  "handoff-map": "Distribute the work",
};

const TONES: GraphTone[] = ["blue", "mint", "gold", "violet", "clay"];

function toneFor(slug: string): GraphTone {
  let total = 0;
  for (const character of slug) total += character.charCodeAt(0);
  return TONES[total % TONES.length] ?? "blue";
}

function categoryFor(slug: string): string {
  return CATEGORY_BY_SLUG[slug] ?? "Team practice";
}

function toAtlasSkill(parsed: Awaited<ReturnType<typeof readLocalSkills>>[number]): AtlasSkill {
  return {
    slug: parsed.slug,
    name: parsed.name,
    description: parsed.description,
    category: categoryFor(parsed.slug),
    version: "Git source",
    reviewed: "Mounted checkout",
    sourcePath: parsed.sourcePath,
    excerpt: parsed.excerpt,
    relations: [],
    usage: 0,
    tone: toneFor(parsed.slug),
  };
}

export function isSafeSourcePath(root: string, target: string): boolean {
  const rootPath = resolve(root);
  const targetPath = resolve(target);
  const distance = relative(rootPath, targetPath);
  return distance === "" || (!distance.startsWith("..") && !isAbsolute(distance));
}

async function requireDirectory(path: string, missingCode: SourceErrorCode): Promise<void> {
  let info;
  try {
    info = await lstat(path);
  } catch {
    throw new SourceError(missingCode);
  }
  if (info.isSymbolicLink()) throw new SourceError("unsafe-symlink");
  if (!info.isDirectory()) throw new SourceError("invalid-root");
}

async function readBounded(path: string): Promise<string> {
  let info;
  try {
    info = await lstat(path);
  } catch {
    throw new SourceError("read-failed");
  }
  if (info.isSymbolicLink()) throw new SourceError("unsafe-symlink");
  if (!info.isFile()) throw new SourceError("read-failed");
  if (info.size > MAX_SKILL_BYTES) throw new SourceError("file-too-large");

  const read = readFile(path, "utf8").catch(() => {
    throw new SourceError("read-failed");
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new SourceError("read-timeout")), READ_TIMEOUT_MS);
  });
  try {
    return await Promise.race([read, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function readLocalSkills(
  repoRoot: string,
): Promise<ReturnType<typeof parseSkillMarkdown>[]> {
  if (!repoRoot.trim()) throw new SourceError("invalid-root");
  const root = resolve(repoRoot);
  await requireDirectory(root, "invalid-root");

  const skillsDirectory = resolve(root, "skills");
  if (!isSafeSourcePath(root, skillsDirectory)) throw new SourceError("unsafe-path");
  await requireDirectory(skillsDirectory, "missing-skills-directory");

  let entries;
  try {
    entries = await readdir(skillsDirectory, { withFileTypes: true });
  } catch {
    throw new SourceError("read-failed");
  }
  if (entries.length > MAX_SKILLS) throw new SourceError("too-many-skills");

  const parsed = [] as ReturnType<typeof parseSkillMarkdown>[];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw new SourceError("unsafe-symlink");
    if (!entry.isDirectory()) continue;
    const skillDirectory = resolve(skillsDirectory, entry.name);
    if (!isSafeSourcePath(skillsDirectory, skillDirectory)) throw new SourceError("unsafe-path");
    const filePath = resolve(skillDirectory, "SKILL.md");
    if (!isSafeSourcePath(skillDirectory, filePath)) throw new SourceError("unsafe-path");
    try {
      const source = await readBounded(filePath);
      parsed.push(parseSkillMarkdown(source, entry.name));
    } catch (error) {
      if (error instanceof SourceError) throw error;
      if (error instanceof SkillParseError) throw new SourceError("invalid-skill");
      throw new SourceError("invalid-skill");
    }
  }
  if (parsed.length === 0) throw new SourceError("empty-source");
  return parsed.sort((left, right) => left.name.localeCompare(right.name));
}

function fallbackSnapshot(warning?: string): AtlasSnapshot {
  return warning
    ? {
        kind: "atlas-snapshot",
        source: "bundled",
        repository: "Bundled public snapshot",
        skills: BUNDLED_SKILLS,
        warning,
      }
    : {
        kind: "atlas-snapshot",
        source: "bundled",
        repository: "Bundled public snapshot",
        skills: BUNDLED_SKILLS,
      };
}

export async function loadAtlasSnapshot(repoRoot?: string): Promise<AtlasSnapshot> {
  if (!repoRoot?.trim()) return fallbackSnapshot();
  try {
    const parsed = await readLocalSkills(repoRoot);
    return {
      kind: "atlas-snapshot",
      source: "local",
      repository: "Mounted Git checkout",
      skills: parsed.map(toAtlasSkill),
    };
  } catch (error) {
    const code = error instanceof SourceError ? error.code : "read-failed";
    return fallbackSnapshot(`Local source unavailable (${code}); showing the bundled snapshot.`);
  }
}
