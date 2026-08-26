import type { AtlasHealth, AtlasSkill, AtlasSnapshot, GraphTone } from "../types.js";
import { MAX_SKILL_DESCRIPTION_CHARS, MAX_SKILL_SLUG_CHARS } from "./skill-parser.js";

const tones: GraphTone[] = ["blue", "mint", "gold", "violet", "clay"];

function isString(value: unknown, max = 1000): value is string {
  return typeof value === "string" && value.length <= max;
}

function isSkill(value: unknown): value is AtlasSkill {
  if (!value || typeof value !== "object") return false;
  const skill = value as Record<string, unknown>;
  return (
    isString(skill.slug, MAX_SKILL_SLUG_CHARS) &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(skill.slug) &&
    isString(skill.name, 120) &&
    isString(skill.description, MAX_SKILL_DESCRIPTION_CHARS) &&
    isString(skill.category, 80) &&
    isString(skill.version, 80) &&
    isString(skill.reviewed, 100) &&
    isString(skill.sourcePath, 180) &&
    /^skills\/[a-z0-9]+(?:-[a-z0-9]+)*\/SKILL\.md$/u.test(skill.sourcePath) &&
    isString(skill.excerpt, 700) &&
    Array.isArray(skill.relations) &&
    skill.relations.length <= 20 &&
    skill.relations.every((relation) => isString(relation, 80)) &&
    typeof skill.usage === "number" &&
    Number.isInteger(skill.usage) &&
    skill.usage >= 0 &&
    skill.usage <= 1000000 &&
    typeof skill.tone === "string" &&
    tones.includes(skill.tone as GraphTone)
  );
}

export function parseSnapshotPayload(value: unknown): AtlasSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const snapshot = value as Record<string, unknown>;
  if (
    snapshot.kind !== "atlas-snapshot" ||
    (snapshot.source !== "bundled" && snapshot.source !== "local") ||
    !isString(snapshot.repository, 140) ||
    !Array.isArray(snapshot.skills) ||
    snapshot.skills.length > 100 ||
    !snapshot.skills.every(isSkill)
  ) {
    return null;
  }
  if (snapshot.warning !== undefined && !isString(snapshot.warning, 240)) return null;
  return snapshot as unknown as AtlasSnapshot;
}

export function parseHealthPayload(value: unknown): AtlasHealth | null {
  if (!value || typeof value !== "object") return null;
  const health = value as Record<string, unknown>;
  if (
    health.status !== "ok" ||
    (health.source !== "bundled" && health.source !== "local") ||
    typeof health.skills !== "number" ||
    !Number.isInteger(health.skills) ||
    health.skills < 0 ||
    health.skills > 100 ||
    typeof health.fallback !== "boolean"
  ) {
    return null;
  }
  return health as unknown as AtlasHealth;
}
