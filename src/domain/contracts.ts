import type {
  AtlasHealth,
  AtlasPack,
  AtlasSkill,
  GraphTone,
  PluginComponent,
  ProposalRequest,
  ProposalResult,
  SessionState,
} from "../types.js";
import {
  MAX_SKILL_BYTES,
  MAX_SKILL_DESCRIPTION_CHARS,
  MAX_SKILL_SLUG_CHARS,
  isSafeSkillSlug,
} from "./skill-parser.js";

const tones: GraphTone[] = ["blue", "mint", "gold", "violet", "clay"];
const SHA = /^[a-f0-9]{40}$/u;
const PROPOSAL_ID = /^[a-z0-9](?:[a-z0-9-]{6,34}[a-z0-9])$/u;
const REPOSITORY = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/u;
const PLUGIN_COMPONENTS = new Set<PluginComponent>(["skills", "apps", "mcpServers"]);

function isString(value: unknown, maximum: number, allowEmpty = false): value is string {
  return (
    typeof value === "string" && value.length <= maximum && (allowEmpty || value.trim().length > 0)
  );
}

function isSkill(value: unknown): value is AtlasSkill {
  if (!value || typeof value !== "object") return false;
  const skill = value as Record<string, unknown>;
  return (
    isString(skill.slug, MAX_SKILL_SLUG_CHARS) &&
    isSafeSkillSlug(skill.slug) &&
    isString(skill.name, 120) &&
    isString(skill.description, MAX_SKILL_DESCRIPTION_CHARS) &&
    isString(skill.category, 80) &&
    isString(skill.sourcePath, 190) &&
    skill.sourcePath === `skills/${skill.slug}/SKILL.md` &&
    isString(skill.markdown, MAX_SKILL_BYTES) &&
    Array.isArray(skill.relations) &&
    skill.relations.length <= 40 &&
    skill.relations.every((relation) => isString(relation, MAX_SKILL_SLUG_CHARS)) &&
    typeof skill.tone === "string" &&
    tones.includes(skill.tone as GraphTone)
  );
}

export function isRepositoryName(value: string): boolean {
  return REPOSITORY.test(value) && !value.endsWith(".git") && !value.includes("..");
}

export function parsePackPayload(value: unknown): AtlasPack | null {
  if (!value || typeof value !== "object") return null;
  const pack = value as Record<string, unknown>;
  if (
    pack.kind !== "atlas-pack" ||
    !isString(pack.id, 220) ||
    !isString(pack.repository, 220) ||
    !isString(pack.defaultBranch, 180) ||
    !isString(pack.revision, 80) ||
    (pack.access !== "read" && pack.access !== "write") ||
    (pack.source !== "example" && pack.source !== "github" && pack.source !== "local") ||
    !isString(pack.snapshotLabel, 160) ||
    !Array.isArray(pack.components) ||
    pack.components.length > 3 ||
    !pack.components.every(
      (component) =>
        typeof component === "string" && PLUGIN_COMPONENTS.has(component as PluginComponent),
    ) ||
    new Set(pack.components).size !== pack.components.length ||
    !Array.isArray(pack.skills) ||
    pack.skills.length > 100 ||
    !pack.skills.every(isSkill)
  ) {
    return null;
  }
  if (pack.repositoryUrl !== undefined && !isString(pack.repositoryUrl, 300)) return null;
  return pack as unknown as AtlasPack;
}

export function parseHealthPayload(value: unknown): AtlasHealth | null {
  if (!value || typeof value !== "object") return null;
  const health = value as Record<string, unknown>;
  if (
    health.status !== "ok" ||
    health.mode !== "self-hosted" ||
    typeof health.adminConfigured !== "boolean" ||
    typeof health.githubConfigured !== "boolean" ||
    health.sessions !== "memory"
  ) {
    return null;
  }
  return health as unknown as AtlasHealth;
}

export function parseSessionPayload(value: unknown): SessionState | null {
  if (!value || typeof value !== "object") return null;
  const session = value as Record<string, unknown>;
  if (
    session.kind !== "atlas-session" ||
    (session.mode !== "static" && session.mode !== "self-hosted") ||
    typeof session.authenticated !== "boolean" ||
    typeof session.adminAvailable !== "boolean" ||
    typeof session.providerAvailable !== "boolean"
  ) {
    return null;
  }
  return session as unknown as SessionState;
}

export function parseProposalRequest(value: unknown): ProposalRequest | null {
  if (!value || typeof value !== "object") return null;
  const request = value as Record<string, unknown>;
  if (
    !isString(request.repository, 220) ||
    !isRepositoryName(request.repository) ||
    !isString(request.path, 190) ||
    !/^skills\/[a-z0-9]+(?:-[a-z0-9]+)*\/SKILL\.md$/u.test(request.path) ||
    !isString(request.baseSha, 40) ||
    !SHA.test(request.baseSha) ||
    !isString(request.content, MAX_SKILL_BYTES) ||
    !isString(request.title, 120) ||
    !isString(request.proposalId, 36) ||
    !PROPOSAL_ID.test(request.proposalId)
  ) {
    return null;
  }
  return request as unknown as ProposalRequest;
}

export function parseProposalResult(value: unknown): ProposalResult | null {
  if (!value || typeof value !== "object") return null;
  const result = value as Record<string, unknown>;
  if (
    result.kind !== "proposal" ||
    !isString(result.branch, 220) ||
    !isString(result.pullRequestUrl, 400) ||
    typeof result.pullRequestNumber !== "number" ||
    !Number.isInteger(result.pullRequestNumber) ||
    result.pullRequestNumber < 1
  ) {
    return null;
  }
  return result as unknown as ProposalResult;
}
