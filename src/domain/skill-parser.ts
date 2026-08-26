export const MAX_SKILL_BYTES = 128 * 1024;
export const MAX_EXCERPT_CHARS = 560;
export const MAX_SKILL_SLUG_CHARS = 80;
export const MAX_SKILL_DESCRIPTION_CHARS = 320;

const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_KEY = /^[a-z][a-z0-9_-]*$/;

export interface ParsedSkill {
  slug: string;
  name: string;
  description: string;
  body: string;
  excerpt: string;
  sourcePath: string;
}

export type SkillParseCode =
  | "invalid-slug"
  | "missing-frontmatter"
  | "invalid-frontmatter"
  | "missing-required-field"
  | "invalid-name"
  | "invalid-description"
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

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function containsControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return (code >= 0 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31);
  });
}

function parseFrontmatter(source: string): { fields: Record<string, string>; body: string } {
  if (!source.startsWith("---\n")) {
    throw new SkillParseError("missing-frontmatter");
  }

  const closing = source.indexOf("\n---", 4);
  if (closing < 0) {
    throw new SkillParseError("invalid-frontmatter");
  }

  const markerEnd = closing + 4;
  const markerRemainder = source.slice(markerEnd);
  if (markerRemainder.length > 0 && !markerRemainder.startsWith("\n")) {
    throw new SkillParseError("invalid-frontmatter");
  }

  const fields: Record<string, string> = {};
  for (const line of source.slice(4, closing).split("\n")) {
    if (!line.trim()) continue;
    const separator = line.indexOf(":");
    if (separator <= 0 || line.slice(0, 1).trim() !== line.slice(0, 1)) {
      throw new SkillParseError("invalid-frontmatter");
    }
    const key = line.slice(0, separator).trim();
    const value = unquote(line.slice(separator + 1));
    if (!SAFE_KEY.test(key) || !value || containsControlCharacter(value)) {
      throw new SkillParseError("invalid-frontmatter");
    }
    if (fields[key] !== undefined) {
      throw new SkillParseError("invalid-frontmatter");
    }
    fields[key] = value;
  }

  const body = source.slice(markerEnd).replace(/^\n/, "").trim();
  return { fields, body };
}

function excerptFrom(body: string): string {
  const compact = body.replace(/\s+/gu, " ").trim();
  if (compact.length <= MAX_EXCERPT_CHARS) return compact;
  return `${compact.slice(0, MAX_EXCERPT_CHARS - 1).trimEnd()}…`;
}

export function parseSkillMarkdown(source: string, slug: string): ParsedSkill {
  if (!isSafeSkillSlug(slug)) {
    throw new SkillParseError("invalid-slug");
  }
  if (byteLength(source) > MAX_SKILL_BYTES) {
    throw new SkillParseError("file-too-large");
  }

  const { fields, body } = parseFrontmatter(source);
  if (Object.keys(fields).some((key) => !["name", "description"].includes(key))) {
    throw new SkillParseError("invalid-frontmatter");
  }
  if (!fields.name || !fields.description) {
    throw new SkillParseError("missing-required-field");
  }
  if (fields.name !== slug) {
    throw new SkillParseError("invalid-name");
  }
  if (fields.description.length > MAX_SKILL_DESCRIPTION_CHARS) {
    throw new SkillParseError("invalid-description");
  }
  if (!body) {
    throw new SkillParseError("empty-body");
  }

  return {
    slug,
    name: fields.name,
    description: fields.description,
    body,
    excerpt: excerptFrom(body),
    sourcePath: `skills/${slug}/SKILL.md`,
  };
}
