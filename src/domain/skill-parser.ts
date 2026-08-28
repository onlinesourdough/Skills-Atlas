import { parseDocument } from "yaml";

export const MAX_SKILL_BYTES = 128 * 1024;
export const MAX_SKILL_SLUG_CHARS = 80;
export const MAX_SKILL_DESCRIPTION_CHARS = 600;

const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export interface ParsedSkill {
  slug: string;
  name: string;
  description: string;
  category?: string;
  explicitRelations: string[];
  body: string;
  markdown: string;
  sourcePath: string;
}

export type SkillParseCode =
  | "invalid-slug"
  | "missing-frontmatter"
  | "invalid-frontmatter"
  | "missing-required-field"
  | "invalid-name"
  | "invalid-description"
  | "invalid-metadata"
  | "empty-body"
  | "file-too-large";

export class SkillParseError extends Error {
  readonly code: SkillParseCode;

  constructor(code: SkillParseCode) {
    super(code);
    this.name = "SkillParseError";
    this.code = code;
  }
}

export function isSafeSkillSlug(slug: string): boolean {
  return slug.length <= MAX_SKILL_SLUG_CHARS && SAFE_SLUG.test(slug);
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function plainRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function optionalString(value: unknown, maximum: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new SkillParseError("invalid-metadata");
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maximum) throw new SkillParseError("invalid-metadata");
  return trimmed;
}

function relationList(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 40) {
    throw new SkillParseError("invalid-metadata");
  }
  const relations = value.map((item) => {
    if (typeof item !== "string" || !isSafeSkillSlug(item.trim())) {
      throw new SkillParseError("invalid-metadata");
    }
    return item.trim();
  });
  return [...new Set(relations)];
}

function splitFrontmatter(source: string): { frontmatter: string; body: string } {
  const normalized = source.startsWith("\uFEFF") ? source.slice(1) : source;
  if (!normalized.startsWith("---\n") && !normalized.startsWith("---\r\n")) {
    throw new SkillParseError("missing-frontmatter");
  }
  const match = /\r?\n---(?:\r?\n|$)/u.exec(normalized.slice(3));
  if (!match || match.index === undefined) throw new SkillParseError("invalid-frontmatter");
  const frontmatterStart = normalized.startsWith("---\r\n") ? 5 : 4;
  const closingStart = 3 + match.index;
  const bodyStart = closingStart + match[0].length;
  return {
    frontmatter: normalized.slice(frontmatterStart, closingStart),
    body: normalized.slice(bodyStart).trim(),
  };
}

function displayName(body: string, fallback: string): string {
  const heading = /^#\s+(.+)$/mu.exec(body)?.[1]?.trim();
  if (!heading || heading.length > 120) return fallback;
  return heading.replace(/[*_`]/gu, "").trim() || fallback;
}

export function parseSkillMarkdown(source: string, slug: string): ParsedSkill {
  if (!isSafeSkillSlug(slug)) throw new SkillParseError("invalid-slug");
  if (byteLength(source) > MAX_SKILL_BYTES) throw new SkillParseError("file-too-large");

  const { frontmatter, body } = splitFrontmatter(source);
  if (!body) throw new SkillParseError("empty-body");

  const document = parseDocument(frontmatter, {
    prettyErrors: false,
    schema: "core",
  });
  if (document.errors.length > 0) throw new SkillParseError("invalid-frontmatter");
  const fields = plainRecord(document.toJS({ maxAliasCount: 0 }));
  if (!fields) throw new SkillParseError("invalid-frontmatter");

  if (typeof fields.name !== "string" || typeof fields.description !== "string") {
    throw new SkillParseError("missing-required-field");
  }
  const frontmatterName = fields.name.trim();
  const description = fields.description.trim();
  if (frontmatterName !== slug) throw new SkillParseError("invalid-name");
  if (!description || description.length > MAX_SKILL_DESCRIPTION_CHARS) {
    throw new SkillParseError("invalid-description");
  }

  const metadata = fields.metadata === undefined ? null : plainRecord(fields.metadata);
  if (fields.metadata !== undefined && !metadata) throw new SkillParseError("invalid-metadata");
  const category = optionalString(fields.category ?? metadata?.category, 80);
  const explicitRelations = relationList(fields.relations ?? metadata?.relations);

  return {
    slug,
    name: displayName(body, frontmatterName),
    description,
    ...(category ? { category } : {}),
    explicitRelations,
    body,
    markdown: source,
    sourcePath: `skills/${slug}/SKILL.md`,
  };
}
